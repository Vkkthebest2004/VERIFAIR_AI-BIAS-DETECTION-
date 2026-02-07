
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from typing import Dict, Any
import logging

from backend.core.sentinel import VerifairSentinel
from backend.services.ingestion import IngestionService

router = APIRouter()
logger = logging.getLogger("VerifairAPI")

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import logging
import json
from datetime import datetime

from backend.core.sentinel import VerifairSentinel
from backend.services.ingestion import IngestionService
from backend.core.explainer import ExplainerService
from backend.core.database import get_db
from backend.core.models import User, AuditRecord
from backend.api.auth import get_current_user

router = APIRouter()
logger = logging.getLogger("VerifairAPI")

# Initialize Sentinel
try:
    sentinel = VerifairSentinel()
except Exception as e:
    logger.critical(f"Failed to initialize Sentinel: {e}")
    sentinel = None

@router.post("/audit", response_model=List[Dict[str, Any]])
async def audit_content(
    files: List[UploadFile] = File(default=None), 
    text_input: Optional[str] = Form(default=None),
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
    
    # Validation
    if not files and not text_input:
         raise HTTPException(status_code=400, detail="No content provided. Upload files or enter text.")

    results_list = []
    
    # Helper to process single item
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
                explanation = await ExplainerService.explain_bias(res["text_snippet"], flagged_ids, z_scores)
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
            full_report_json=json.loads(json.dumps(response_data)),
            owner=current_user
        )
        db.add(new_record)
        return new_record

    try:
        # 1. Process Files
        if files:
            for file in files:
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
                    logger.warning(f"Skipping unsupported file type: {file.filename} ({file.content_type})")

        # 2. Process Raw Text
        if text_input:
            text = IngestionService.extract_text_from_raw(text_input)
            # Use timestamp or snippet as filename for text
            name = f"Text Input {datetime.utcnow().strftime('%H:%M:%S')}"
            record = await process_content(name, text)
            if record:
                results_list.append(record)

        db.commit()
        
        # --- NEW: Batch Aggregation & Conclusion ---
        if len(results_list) > 1:
            total_flags = sum(r.bias_flags_count for r in results_list)
            total_sentences = sum(r.total_sentences for r in results_list)
            
            # Find document with most bias
            most_biased = max(results_list, key=lambda x: x.bias_flags_count)
            
            # Aggregate top identities (this requires parsing JSON or storing it separately, 
            # for now let's just do a simple pass if we have the objects in memory before refresh)
            # Since r.full_report_json is loaded from DB after refresh, we can use it.
            
            all_identities = []
            for r in results_list:
                # Need to refresh to access full_report_json if not eager loaded
                db.refresh(r) 
                report = r.full_report_json
                if report and "results" in report:
                     for item in report["results"]:
                         for flag in item.get("bias_flags", []):
                             all_identities.append(flag["identity"])
            
            top_identities = list(set(all_identities))[:5] # Simple unique list for now
            
            batch_stats = {
                "total_files": len(results_list),
                "total_sentences": total_sentences,
                "total_flags": total_flags,
                "most_biased_file": most_biased.filename,
                "top_identities": top_identities
            }
            
            # Generate LLM Conclusion
            conclusion = await ExplainerService.generate_batch_conclusion(batch_stats)
            
            # Create a "Summary Record"
            summary_data = {
                "filename": f"Batch Summary ({len(results_list)} files)",
                "total_sentences_analyzed": total_sentences,
                "bias_flags_count": total_flags,
                "results": [], # No snippets, just summary text
                "batch_conclusion": conclusion, # NEW FIELD
                "is_batch_summary": True,
                "batch_stats": batch_stats
            }
            
            summary_record = AuditRecord(
                filename=f"BATCH REPORT: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
                total_sentences=total_sentences,
                bias_flags_count=total_flags,
                full_report_json=summary_data,
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
        
    return record.full_report_json

@router.get("/health")
def health_check():
    return {"status": "ok", "sentinel_loaded": sentinel is not None}

from pydantic import BaseModel

class SelectionBiasRequest(BaseModel):
    candidates: List[Dict[str, Any]]
    identity_groups: Optional[List[str]] = None

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
