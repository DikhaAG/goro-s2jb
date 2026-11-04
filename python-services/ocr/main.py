#!/usr/bin/env python3
import sys
import os
import json
import time
import argparse
import io
import base64
from typing import Optional, Dict, Any
from PIL import Image

from engine import extract_text_from_image, extract_text_with_auto_orientation
from preprocessor import normalize_orientation
from matcher import calculate_similarity
from hasher import calculate_phash, hamming_distance, is_visual_duplicate

# FastAPI imports
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(
    title="GORO S2JB AI Vision & OCR Service",
    description="Microservice untuk OCR Tesseract, Perceptual Hashing, dan Fuzzy Matching Triase 3 Zona",
    version="2.0.0",
)

class ProcessRequest(BaseModel):
    image_path: Optional[str] = None
    image_base64: Optional[str] = None
    target_name: Optional[str] = ""

class ProcessResponse(BaseModel):
    success: bool
    extracted_text: str
    phash: str
    similarity_score: float
    zone: str
    recommended_status: str
    execution_time_ms: int
    error: Optional[str] = None

class CompareHashRequest(BaseModel):
    hash1: str
    hash2: str
    max_distance: Optional[int] = 5

class CompareHashResponse(BaseModel):
    hamming_distance: int
    is_duplicate: bool

def process_evidence(
    image_path: Optional[str] = None,
    image_base64: Optional[str] = None,
    target_name: Optional[str] = "",
) -> Dict[str, Any]:
    start_time = time.time()

    img = None
    try:
        if image_base64:
            img_bytes = base64.b64decode(image_base64)
            img = Image.open(io.BytesIO(img_bytes))
        elif image_path and os.path.exists(image_path):
            img = Image.open(image_path)
        else:
            return {
                "success": False,
                "extracted_text": "",
                "phash": "",
                "similarity_score": 0.0,
                "zone": "RED",
                "recommended_status": "REJECTED",
                "execution_time_ms": int((time.time() - start_time) * 1000),
                "error": f"Image not provided or file not found (path: {image_path})",
            }

        with img:
            # 1. Normalize EXIF orientation (handles smartphone photos saved in landscape)
            img = normalize_orientation(img)

            # 2. Extract text with auto-orientation fallback (handles physical screen photos, cracks, and blur)
            extracted_text, similarity_score, zone, recommended_status, best_img = (
                extract_text_with_auto_orientation(img, target_name or "")
            )

            # 3. Calculate 64-bit perceptual hash (pHash) on the correctly oriented image
            phash = calculate_phash(best_img)

        execution_time_ms = int((time.time() - start_time) * 1000)

        return {
            "success": True,
            "extracted_text": extracted_text,
            "phash": phash,
            "similarity_score": similarity_score,
            "zone": zone,
            "recommended_status": recommended_status,
            "execution_time_ms": execution_time_ms,
            "error": None,
        }
    except Exception as e:
        return {
            "success": False,
            "extracted_text": "",
            "phash": "",
            "similarity_score": 0.0,
            "zone": "RED",
            "recommended_status": "REJECTED",
            "execution_time_ms": int((time.time() - start_time) * 1000),
            "error": str(e),
        }

@app.get("/health")
def health():
    return {"status": "UP", "service": "GORO S2JB OCR Vision Core", "timestamp": time.time()}

@app.post("/api/v1/process", response_model=ProcessResponse)
def api_process(req: ProcessRequest):
    result = process_evidence(
        image_path=req.image_path,
        image_base64=req.image_base64,
        target_name=req.target_name,
    )
    return result

@app.post("/api/v1/compare-hash", response_model=CompareHashResponse)
def api_compare_hash(req: CompareHashRequest):
    dist = hamming_distance(req.hash1, req.hash2)
    is_dup = is_visual_duplicate(req.hash1, req.hash2, req.max_distance or 5)
    return {"hamming_distance": dist, "is_duplicate": is_dup}

def cli_main():
    parser = argparse.ArgumentParser(description="GORO S2JB OCR & pHash Extractor")
    parser.add_argument("--image", default="", help="Path to evidence image")
    parser.add_argument("--base64", default="", help="Base64 encoded evidence image (in-memory streaming)")
    parser.add_argument("--expected-name", default="", help="Expected Play Store reviewer name")
    args = parser.parse_args()

    b64_data = args.base64
    if b64_data == "-":
        b64_data = sys.stdin.read().strip()

    result = process_evidence(
        image_path=args.image if args.image else None,
        image_base64=b64_data if b64_data else None,
        target_name=args.expected_name,
    )
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    if len(sys.argv) > 1 and ("--image" in sys.argv or "--base64" in sys.argv or "--help" in sys.argv):
        cli_main()
    else:
        import uvicorn
        port = int(os.environ.get("OCR_PORT", 8001))
        uvicorn.run("main:app", host="127.0.0.1", port=port, log_level="info")
