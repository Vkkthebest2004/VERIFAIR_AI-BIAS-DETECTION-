
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import logging
import json
import numpy as np
from datetime import datetime

from backend.core.sentinel_registry import get_sentinel
from backend.services.ingestion import IngestionService
from backend.core.explainer import ExplainerService
from backend.core.database import get_db
from backend.core.models import User, AuditRecord
from backend.api.auth import get_current_user

router = APIRouter()
logger = logging.getLogger("VerifairAPI")


def convert_numpy(obj):
    """Recursively convert numpy types to native Python for JSON serialization."""
    if isinstance(obj, dict):
        return {k: convert_numpy(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy(i) for i in obj]
    elif isinstance(obj, (np.bool_,)):
        return bool(obj)
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating, float)):
        # Handle NaN and Infinity which are not valid JSON
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return [convert_numpy(i) for i in obj.tolist()]
    return obj

# Initialize Sentinel — shared singleton (loaded once, used everywhere)
sentinel = get_sentinel()

@router.post("/audit", response_model=List[Dict[str, Any]])
async def audit_content(
    files: List[UploadFile] = File(default=None), 
    text_input: Optional[str] = Form(default=None),
    context: Optional[str] = Form(default="General"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Endpoint to audit content (Files + Text) for bias.
    Supports multiple files and raw text.
    Requires Authentication.
    """
    if not sentinel:
        raise HTTPException(status_code=503, detail="Bias Detection Engine not initialized.")
    
    # Clean up files list — browsers may send empty UploadFile entries
    valid_files = []
    if files:
        for f in files:
            if f and f.filename and f.filename.strip():
                valid_files.append(f)
    
    # Validation
    if not valid_files and not text_input:
         raise HTTPException(status_code=400, detail="No content provided. Upload files or enter text.")

    logger.info(f"Received {len(valid_files)} files and text_input={'yes' if text_input else 'no'}")

    results_list = []
    
    # Helper to process single item
    async def process_content(name: str, raw_text: str):
        if not raw_text or not raw_text.strip():
            return None
            

        text_chunks = IngestionService.clean_and_chunk_text(raw_text)
        analysis_results = sentinel.batch_analyze(text_chunks)
        
        # --- NEW: Pipeline Step - Explain Bias ---
        for res in analysis_results:
            if res["is_biased"]:
                # Get the flagged identities
                flagged_ids = [f["identity"] for f in res["bias_flags"]]
                z_scores = [f["z_score"] for f in res["bias_flags"]]
                
                # Call Llama 3.2
                explanation = await ExplainerService.explain_bias(res["text_snippet"], flagged_ids, z_scores, context=context)
                res["explanation"] = explanation
        # -----------------------------------------

        total_flags = sum(1 for res in analysis_results if res["is_biased"])
        
        response_data = {
            "filename": name,
            "total_sentences_analyzed": len(text_chunks),
            "bias_flags_count": total_flags,
            "results": analysis_results
        }
        
        # Save to DB
        new_record = AuditRecord(
            filename=name,
            total_sentences=len(text_chunks),
            bias_flags_count=total_flags,
            full_report_json=convert_numpy(json.loads(json.dumps(response_data, default=str))),
            owner=current_user
        )
        db.add(new_record)
        return new_record

    try:
        # 1. Process Files
        if valid_files:
            for file in valid_files:
                if file.content_type == "application/pdf":
                    file_bytes = await file.read()
                    text = IngestionService.extract_text_from_pdf(file_bytes)
                    record = await process_content(file.filename, text)
                    if record:
                        results_list.append(record)
                elif file.content_type == "text/plain" or file.filename.endswith('.txt'):
                    # Handle text files
                    file_bytes = await file.read()
                    text = file_bytes.decode('utf-8', errors='ignore')
                    record = await process_content(file.filename, text)
                    if record:
                        results_list.append(record)
                elif file.content_type == "text/csv" or file.filename.endswith('.csv'):
                    # Handle CSV files
                    import pandas as pd
                    import io
                    
                    file_bytes = await file.read()
                    csv_content = file_bytes.decode('utf-8', errors='ignore')
                    
                    try:
                        # Parse CSV using pandas
                        df = pd.read_csv(io.StringIO(csv_content))
                        
                        # Process each row as separate text
                        for idx, row in df.iterrows():
                            # Combine all columns into a single text
                            row_text = ' | '.join([f"{col}: {val}" for col, val in row.items() if pd.notna(val)])
                            
                            if row_text.strip():
                                record = await process_content(
                                    f"{file.filename} - Row {idx + 1}",
                                    row_text
                                )
                                if record:
                                    results_list.append(record)
                        
                        logger.info(f"Processed CSV file: {file.filename} with {len(df)} rows")
                    except Exception as e:
                        logger.error(f"Failed to parse CSV {file.filename}: {e}")
                        # Fallback: treat as plain text
                        record = await process_content(file.filename, csv_content)
                        if record:
                            results_list.append(record)
                else:
                    # Fallback: try to read as plain text for unknown types
                    # This handles .txt files created from Blob in browsers that may have
                    # content_type='application/octet-stream' or empty
                    logger.info(f"Unknown type '{file.content_type}' for {file.filename}, trying as text...")
                    try:
                        file_bytes = await file.read()
                        text = file_bytes.decode('utf-8', errors='ignore')
                        if text.strip():
                            record = await process_content(file.filename, text)
                            if record:
                                results_list.append(record)
                        else:
                            logger.warning(f"File {file.filename} was empty after reading as text")
                    except Exception as e:
                        logger.warning(f"Could not process {file.filename}: {e}")

        # 2. Process Raw Text
        if text_input:
            text = IngestionService.extract_text_from_raw(text_input)
            # Use timestamp or snippet as filename for text
            name = f"Text Input {datetime.utcnow().strftime('%H:%M:%S')}"
            record = await process_content(name, text)
            if record:
                results_list.append(record)

        db.commit()
        
        if len(results_list) > 1:
            # Import CollectiveReporter
            from backend.core.reporting import CollectiveReporter
            
            # --- Generate Collective Report ---
            collective_report = CollectiveReporter.generate_report(results_list)
            
            # Generate LLM Conclusion based on the collective stats
            conclusion = await ExplainerService.generate_batch_conclusion(collective_report, context=context)
            
            # Merge the conclusion into the report
            collective_report["batch_conclusion"] = conclusion
            collective_report["filename"] = f"COLLECTIVE REPORT ({len(results_list)} files)"
            
            # Embed ALL individual results into the summary for the frontend to access if needed
            # (Though the new UI might just show the collective stats)
            all_results = []
            for r in results_list:
                db.refresh(r)
                if r.full_report_json and "results" in r.full_report_json:
                    for item in r.full_report_json["results"]:
                        item_copy = dict(item)
                        item_copy["source_file"] = r.filename
                        all_results.append(item_copy)
            
            collective_report["results"] = all_results

            summary_record = AuditRecord(
                filename=f"COLLECTIVE REPORT: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
                total_sentences=collective_report["total_sentences"],
                bias_flags_count=collective_report["total_bias_flags"],
                full_report_json=convert_numpy(json.loads(json.dumps(collective_report, default=str))),
                owner=current_user
            )
            db.add(summary_record)
            db.commit()
            db.refresh(summary_record)
            
            # Insert summary at the top
            results_list.insert(0, summary_record)
        
        # -------------------------------------------
        
        # Refresh all to get IDs
        response_payload = []
        for r in results_list:
            db.refresh(r)
            data = r.full_report_json
            data["record_id"] = r.id
            response_payload.append(data)
            
        return response_payload

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Internal Server Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An error occurred during processing.")

@router.get("/history", response_model=List[Dict[str, Any]])
def get_audit_history(
    skip: int = 0, 
    limit: int = 20, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """
    Retrieve past audit history for the logged-in user.
    Returns metadata about the audits.
    """
    records = db.query(AuditRecord).filter(AuditRecord.user_id == current_user.id)\
                .order_by(AuditRecord.upload_date.desc())\
                .offset(skip).limit(limit).all()
    
    return [
        {
            "id": r.id,
            "filename": r.filename,
            "upload_date": r.upload_date,
            "total_sentences": r.total_sentences,
            "bias_flags_count": r.bias_flags_count
        }
        for r in records
    ]

@router.get("/history/{record_id}")
def get_audit_detail(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve a specific full audit report.
    """
    record = db.query(AuditRecord).filter(
        AuditRecord.id == record_id, 
        AuditRecord.user_id == current_user.id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="Audit record not found.")
        
    # Merge DB metadata with the JSON report to ensure fields like filename exist
    response = record.full_report_json or {}
    response["record_id"] = record.id
    response["filename"] = record.filename
    response["total_sentences_analyzed"] = record.total_sentences
    response["bias_flags_count"] = record.bias_flags_count
    
    return response

@router.get("/health")
def health_check():
    from backend.version import __version__
    return {"status": "ok", "version": __version__, "sentinel_loaded": sentinel is not None}

from pydantic import BaseModel

class SelectionBiasRequest(BaseModel):
    candidates: List[Dict[str, Any]]
    identity_groups: Optional[List[str]] = None

class ResumeForensicsRequest(BaseModel):
    candidates: List[Dict[str, Any]]

@router.post("/analyze-selection-bias", response_model=Dict[str, Any])
async def analyze_selection_bias(
    request: SelectionBiasRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyze selection bias in batch outcomes.
    
    Implements industry-standard statistical tests:
    - Four-Fifths Rule (EEOC)
    - Chi-Square Test
    - Z-Test for Proportions
    - Adverse Impact Ratio
    
    Request body:
    {
        "candidates": [
            {
                "id": "candidate_1",
                "identities": ["Female", "Asian"],
                "selected": true,
                "score": 85.5
            },
            ...
        ],
        "identity_groups": ["Male", "Female", "Asian", "Black", "White"]  # optional
    }
    
    Returns comprehensive bias analysis with statistical significance.
    """
    from backend.core.selection_bias import detect_selection_bias
    
    try:
        # Perform selection bias analysis
        result = detect_selection_bias(request.candidates, request.identity_groups)
        
        # Convert numpy types to native Python for JSON serialization
        result = convert_numpy(result)
        
        # Store in database
        audit_record = AuditRecord(
            user_id=current_user.id,
            filename=f"Selection Bias Analysis - {len(request.candidates)} candidates",
            total_sentences=len(request.candidates),
            bias_flags_count=len(result.get('four_fifths_violations', [])),
            full_report_json={
                "type": "selection_bias",
                "timestamp": datetime.utcnow().isoformat(),
                "analysis": result
            }
        )
        db.add(audit_record)
        db.commit()
        db.refresh(audit_record)
        
        # Return result with record ID
        return {
            "record_id": audit_record.id,
            "analysis": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Selection bias analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-resume-forensics", response_model=Dict[str, Any])
async def analyze_resume_forensics(
    request: ResumeForensicsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Resume Forensics: Deep bias analysis for hiring data (JSON / CSV mode).
    
    Analyzes resume/hiring CSVs for:
    - Qualification-Controlled Bias (Equalized Odds)
    - Name-Proxy Bias (Indian surname → community)
    - College Pedigree Bias (IIT/NIT preference)
    - Interviewer Language Disparity
    - Skill-Outcome Mismatch
    - Experience Penalty Detection
    """
    from backend.core.resume_bias_analyzer import ResumeBiasAnalyzer
    
    try:
        if len(request.candidates) > 50:
            raise HTTPException(status_code=400, detail="Batch limit is 50 candidates. Please reduce your dataset.")
        
        analyzer = ResumeBiasAnalyzer()
        result = analyzer.analyze(request.candidates)
        
        # Convert numpy types
        result = convert_numpy(result)
        
        # Store in database
        audit_record = AuditRecord(
            user_id=current_user.id,
            filename=f"Resume Forensics - {len(request.candidates)} candidates",
            total_sentences=len(request.candidates),
            bias_flags_count=result.get('forensics_score', {}).get('modules_flagged', 0),
            full_report_json={
                "type": "resume_forensics",
                "timestamp": datetime.utcnow().isoformat(),
                "analysis": result
            }
        )
        db.add(audit_record)
        db.commit()
        db.refresh(audit_record)
        
        return {
            "record_id": audit_record.id,
            "analysis": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resume forensics analysis failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-resume-forensics", response_model=Dict[str, Any])
async def upload_resume_forensics(
    selected_files: List[UploadFile] = File(default=None),
    rejected_files: List[UploadFile] = File(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Resume Forensics: PDF / file upload mode.
    
    Upload resumes tagged as 'Selected' or 'Rejected'.
    Supports PDF and TXT files. Each file is parsed into a candidate record
    and then analyzed for bias patterns.
    
    Batch limit: 50 files total.
    """
    from backend.core.resume_bias_analyzer import ResumeBiasAnalyzer
    from backend.core.resume_parser import ResumeParser
    
    # Validate files exist
    valid_selected = [f for f in (selected_files or []) if f and f.filename and f.filename.strip()]
    valid_rejected = [f for f in (rejected_files or []) if f and f.filename and f.filename.strip()]
    
    total_files = len(valid_selected) + len(valid_rejected)
    
    if total_files < 2:
        raise HTTPException(status_code=400, detail="Upload at least 1 selected and 1 rejected resume.")
    
    if total_files > 50:
        raise HTTPException(status_code=400, detail=f"Batch limit is 50 resumes. You uploaded {total_files}.")
    
    if len(valid_selected) == 0:
        raise HTTPException(status_code=400, detail="Upload at least 1 'Selected' resume.")
    
    if len(valid_rejected) == 0:
        raise HTTPException(status_code=400, detail="Upload at least 1 'Rejected' resume.")
    
    try:
        candidates = []
        parse_errors = []
        
        # Process selected resumes
        for file in valid_selected:
            try:
                file_bytes = await file.read()
                
                if file.filename.lower().endswith('.pdf') or file.content_type == 'application/pdf':
                    text = IngestionService.extract_text_from_pdf(file_bytes)
                else:
                    text = file_bytes.decode('utf-8', errors='ignore')
                
                candidate = ResumeParser.parse(text, filename=file.filename, is_selected=True)
                candidates.append(candidate)
                logger.info(f"Parsed SELECTED resume: {file.filename} → {candidate.get('name', 'Unknown')}")
                
            except Exception as e:
                parse_errors.append(f"Failed to parse {file.filename}: {str(e)}")
                logger.warning(f"Failed to parse selected file {file.filename}: {e}")
        
        # Process rejected resumes
        for file in valid_rejected:
            try:
                file_bytes = await file.read()
                
                if file.filename.lower().endswith('.pdf') or file.content_type == 'application/pdf':
                    text = IngestionService.extract_text_from_pdf(file_bytes)
                else:
                    text = file_bytes.decode('utf-8', errors='ignore')
                
                candidate = ResumeParser.parse(text, filename=file.filename, is_selected=False)
                candidates.append(candidate)
                logger.info(f"Parsed REJECTED resume: {file.filename} → {candidate.get('name', 'Unknown')}")
                
            except Exception as e:
                parse_errors.append(f"Failed to parse {file.filename}: {str(e)}")
                logger.warning(f"Failed to parse rejected file {file.filename}: {e}")
        
        if len(candidates) < 2:
            raise HTTPException(
                status_code=400, 
                detail=f"Only {len(candidates)} resumes parsed successfully. Need at least 2. Errors: {'; '.join(parse_errors)}"
            )
        
        # Run forensics analysis
        analyzer = ResumeBiasAnalyzer()
        result = analyzer.analyze(candidates)
        result = convert_numpy(result)
        
        # Add parse metadata
        result["parse_summary"] = {
            "total_uploaded": total_files,
            "selected_count": len(valid_selected),
            "rejected_count": len(valid_rejected),
            "successfully_parsed": len(candidates),
            "parse_errors": parse_errors,
            "candidates_preview": [
                {
                    "name": c.get("name", "Unknown"),
                    "selected": c.get("selected", False),
                    "college": c.get("college", ""),
                    "skills_count": len(c.get("skills", "").split(";")) if c.get("skills") else 0,
                    "experience": c.get("experience"),
                }
                for c in candidates
            ]
        }
        
        # Store in database
        audit_record = AuditRecord(
            user_id=current_user.id,
            filename=f"Resume Forensics (PDF) - {len(candidates)} resumes ({len(valid_selected)} sel / {len(valid_rejected)} rej)",
            total_sentences=len(candidates),
            bias_flags_count=result.get('forensics_score', {}).get('modules_flagged', 0),
            full_report_json={
                "type": "resume_forensics_pdf",
                "timestamp": datetime.utcnow().isoformat(),
                "analysis": result
            }
        )
        db.add(audit_record)
        db.commit()
        db.refresh(audit_record)
        
        return {
            "record_id": audit_record.id,
            "analysis": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resume forensics PDF upload failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
