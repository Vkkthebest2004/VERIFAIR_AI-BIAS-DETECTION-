
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
import numpy as np
from datetime import datetime

from backend.core.sentinel import VerifairSentinel
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
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

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
        
        # --- NEW: Batch Aggregation & Conclusion ---
        if len(results_list) > 1:
            total_flags = sum(r.bias_flags_count for r in results_list)
            total_sentences = sum(r.total_sentences for r in results_list)
            
            # Find document with most bias
            most_biased = max(results_list, key=lambda x: x.bias_flags_count)
            
            # Aggregate all results from all individual records into one unified list
            all_results = []
            all_identities = []
            all_hate_types = []
            total_hate_detected = 0
            max_hate_score = 0.0
            worst_hate_severity = "None"
            severity_order = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1, "None": 0}
            
            for r in results_list:
                # Refresh to get full_report_json from DB
                db.refresh(r) 
                report = r.full_report_json
                if report and "results" in report:
                    for item in report["results"]:
                        # Tag each result with its source file for clarity
                        item_copy = dict(item)
                        item_copy["source_file"] = r.filename
                        all_results.append(item_copy)
                        
                        # Aggregate identities
                        for flag in item.get("bias_flags", []):
                            all_identities.append(flag["identity"])
                        
                        # Aggregate hate speech data
                        hate_data = item.get("hate_speech_analysis", {})
                        if hate_data.get("hate_detected"):
                            total_hate_detected += 1
                            hs_score = hate_data.get("ensemble_score", 0)
                            if hs_score > max_hate_score:
                                max_hate_score = hs_score
                            hs_severity = hate_data.get("severity", "None")
                            if severity_order.get(hs_severity, 0) > severity_order.get(worst_hate_severity, 0):
                                worst_hate_severity = hs_severity
                            all_hate_types.extend(hate_data.get("hate_types", []))
            
            top_identities = list(set(all_identities))[:5]
            unique_hate_types = list(set(all_hate_types))
            
            batch_stats = {
                "total_files": len(results_list),
                "total_sentences": total_sentences,
                "total_flags": total_flags,
                "most_biased_file": most_biased.filename,
                "top_identities": top_identities,
                "hate_speech_summary": {
                    "total_hate_detected": total_hate_detected,
                    "max_ensemble_score": float(max_hate_score),
                    "worst_severity": worst_hate_severity,
                    "hate_types_found": unique_hate_types
                }
            }
            
            # Generate LLM Conclusion
            conclusion = await ExplainerService.generate_batch_conclusion(batch_stats)
            
            # Create a "Summary Record" — now with ALL results merged
            summary_data = {
                "filename": f"Batch Summary ({len(results_list)} files)",
                "total_sentences_analyzed": total_sentences,
                "bias_flags_count": total_flags,
                "results": all_results,  # <-- ALL results from all files
                "batch_conclusion": conclusion,
                "is_batch_summary": True,
                "batch_stats": batch_stats
            }
            
            summary_record = AuditRecord(
                filename=f"BATCH REPORT: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
                total_sentences=total_sentences,
                bias_flags_count=total_flags,
                full_report_json=convert_numpy(json.loads(json.dumps(summary_data, default=str))),
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
