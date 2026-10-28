#!/usr/bin/env python3
import sys
import os
import json
import time
import argparse
from typing import Dict, Any, Optional
from PIL import Image, ImageEnhance, ImageFilter
import imagehash
from rapidfuzz import fuzz
import pytesseract

# Configure tesseract executable if present in standard Homebrew / Linux paths
if os.path.exists("/opt/homebrew/bin/tesseract"):
    pytesseract.pytesseract.tesseract_cmd = "/opt/homebrew/bin/tesseract"
elif os.path.exists("/usr/bin/tesseract"):
    pytesseract.pytesseract.tesseract_cmd = "/usr/bin/tesseract"
elif os.path.exists("/usr/local/bin/tesseract"):
    pytesseract.pytesseract.tesseract_cmd = "/usr/local/bin/tesseract"

def preprocess_image_for_ocr(img: Image.Image) -> Image.Image:
    """Preprocess image: convert to grayscale and enhance contrast for better OCR extraction."""
    # Convert to grayscale
    gray = img.convert("L")
    # Enhance contrast
    enhancer = ImageEnhance.Contrast(gray)
    enhanced = enhancer.enhance(1.8)
    return enhanced

def calculate_phash(img: Image.Image) -> str:
    """Calculate 64-bit perceptual hash (pHash) and return as hex string."""
    hash_obj = imagehash.phash(img, hash_size=8)
    return str(hash_obj)

def determine_zone_and_status(similarity_score: float) -> tuple[str, str]:
    """
    Determine tactical validation zone and recommended status:
    - GREEN (>= 80%): APPROVED
    - YELLOW (50% - 79.9%): NEEDS_REVIEW
    - RED (< 50%): REJECTED
    """
    if similarity_score >= 80.0:
        return "GREEN", "APPROVED"
    elif similarity_score >= 50.0:
        return "YELLOW", "NEEDS_REVIEW"
    else:
        return "RED", "REJECTED"

def extract_and_verify(image_path: str, expected_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Extract text via OCR, compute perceptual hash, and calculate fuzzy similarity
    against the expected reviewer name.
    """
    start_time = time.time()

    if not os.path.exists(image_path):
        return {
            "success": False,
            "error": f"Image file not found: {image_path}",
            "execution_time_ms": int((time.time() - start_time) * 1000)
        }

    try:
        with Image.open(image_path) as img:
            # 1. Calculate pHash
            phash = calculate_phash(img)

            # 2. Preprocess & Extract text with Tesseract
            processed = preprocess_image_for_ocr(img)
            extracted_text = pytesseract.image_to_string(processed, lang="ind+eng").strip()
            if not extracted_text:
                # Fallback to English if Indonesian language data isn't installed
                extracted_text = pytesseract.image_to_string(processed, lang="eng").strip()

        # 3. Fuzzy similarity calculation
        similarity_score = 0.0
        zone = "RED"
        recommended_status = "REJECTED"

        if expected_name and extracted_text:
            # Calculate highest score between partial_ratio and token_set_ratio
            score_partial = fuzz.partial_ratio(expected_name.lower(), extracted_text.lower())
            score_token_set = fuzz.token_set_ratio(expected_name.lower(), extracted_text.lower())
            similarity_score = round(float(max(score_partial, score_token_set)), 2)

            zone, recommended_status = determine_zone_and_status(similarity_score)
        elif not expected_name:
            zone = "YELLOW"
            recommended_status = "NEEDS_REVIEW"

        execution_time_ms = int((time.time() - start_time) * 1000)

        return {
            "success": True,
            "extracted_text": extracted_text,
            "phash": phash,
            "similarity_score": similarity_score,
            "zone": zone,
            "recommended_status": recommended_status,
            "execution_time_ms": execution_time_ms
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "execution_time_ms": int((time.time() - start_time) * 1000)
        }

def main():
    parser = argparse.ArgumentParser(description="GORO S2JB OCR & pHash Extractor")
    parser.add_argument("--image", required=True, help="Absolute path to evidence image")
    parser.add_argument("--expected-name", default="", help="Expected Play Store reviewer name")
    args = parser.parse_args()

    result = extract_and_verify(args.image, args.expected_name)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
