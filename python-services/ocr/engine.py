import os
import pytesseract
from PIL import Image
from preprocessor import (
    normalize_orientation,
    enhance_for_screen_photo,
    denoise_screen_cracks,
    preprocess_image,
)
from matcher import calculate_similarity

# Auto-detect Tesseract binary path
possible_tesseract_paths = [
    os.environ.get("TESSERACT_PATH", ""),
    "/opt/homebrew/bin/tesseract",
    "/usr/bin/tesseract",
    "/usr/local/bin/tesseract",
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Tesseract-OCR\tesseract.exe"),
]
for p in possible_tesseract_paths:
    if p and os.path.exists(p):
        pytesseract.pytesseract.tesseract_cmd = p
        break

# Auto-detect local tessdata directory if available
local_tessdata = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tessdata")
if os.path.exists(local_tessdata) and not os.environ.get("TESSDATA_PREFIX"):
    os.environ["TESSDATA_PREFIX"] = local_tessdata

def extract_text_from_image(img: Image.Image) -> str:
    """
    Runs multi-pass OCR extraction optimized for mobile screenshots and physical screen photos:
    - Pass 1: Raw image with Indonesian + English models (preserves clean anti-aliasing)
    - Pass 2: Screen photo enhancement (autocontrast + unsharp mask de-blurring)
    - Pass 3: Denoised screen cracks (median filter to suppress thin glass crack lines)
    - Pass 4: Inverted preprocessed image for Dark Mode screenshots
    - Pass 5: PSM 6 (single uniform block) on raw and enhanced variants
    """
    img = normalize_orientation(img)
    lang = "ind+eng"

    extracted_parts = []
    seen_lines = set()

    def add_lines(text: str):
        if not text:
            return
        for line in text.splitlines():
            cleaned = line.strip()
            if cleaned and cleaned not in seen_lines:
                seen_lines.add(cleaned)
                extracted_parts.append(cleaned)

    # Pass 1: Clean raw RGB image
    try:
        t_raw = pytesseract.image_to_string(img, lang=lang).strip()
        add_lines(t_raw)
    except Exception:
        try:
            t_raw = pytesseract.image_to_string(img, lang="eng").strip()
            add_lines(t_raw)
        except Exception:
            pass

    # Pass 2: Enhanced screen photo (de-blur + autocontrast for reflections & camera blur)
    try:
        enhanced = enhance_for_screen_photo(img)
        t_enh = pytesseract.image_to_string(enhanced, lang=lang).strip()
        add_lines(t_enh)
    except Exception:
        pass

    # Pass 3: Denoised screen cracks (median filter suppressing scratch lines)
    try:
        denoised = denoise_screen_cracks(img)
        t_den = pytesseract.image_to_string(denoised, lang=lang).strip()
        add_lines(t_den)
    except Exception:
        pass

    # Pass 4: Inverted dark mode image
    try:
        processed = preprocess_image(img)
        t_proc = pytesseract.image_to_string(processed, lang=lang).strip()
        add_lines(t_proc)
    except Exception:
        pass

    # Pass 5: PSM 6 (Single uniform block of text)
    # Crucial for Play Store mobile review cards where reviewer name sits beside stars/icons
    try:
        t_psm6 = pytesseract.image_to_string(img, lang=lang, config="--psm 6").strip()
        add_lines(t_psm6)
    except Exception:
        try:
            t_psm6 = pytesseract.image_to_string(img, lang="eng", config="--psm 6").strip()
            add_lines(t_psm6)
        except Exception:
            pass

    return "\n".join(extracted_parts).strip()

def extract_text_with_auto_orientation(
    img: Image.Image, target_name: str = ""
) -> tuple[str, float, str, str, Image.Image]:
    """
    Extracts text and automatically resolves orientation even if EXIF metadata is missing.
    If the primary orientation yields a low match score (< 90%), attempts 270, 180, and 90 degree rotations.
    Returns (extracted_text, similarity_score, zone, recommended_status, best_oriented_image).
    """
    oriented = normalize_orientation(img)

    # 1. Primary orientation extraction
    extracted_text = extract_text_from_image(oriented)
    score, zone, status = calculate_similarity(target_name or "", extracted_text)

    # If already high confidence (Green zone >= 90%) or no target name provided, return immediately
    if score >= 90.0 or not target_name:
        return extracted_text, score, zone, status, oriented

    # 2. Orientation fallback: photo may be upside-down or sideways with stripped EXIF
    best_text = extracted_text
    best_score = score
    best_zone = zone
    best_status = status
    best_img = oriented

    # Test 270 deg (most common for smartphone portrait shots stored as landscape), then 180 and 90
    for angle in [270, 180, 90]:
        rotated = oriented.rotate(angle, expand=True)
        rot_text = extract_text_from_image(rotated)
        rot_score, rot_zone, rot_status = calculate_similarity(target_name, rot_text)

        if rot_score > best_score:
            best_text = rot_text
            best_score = rot_score
            best_zone = rot_zone
            best_status = rot_status
            best_img = rotated

            # If Green zone achieved, stop early
            if rot_score >= 90.0:
                break

    return best_text, best_score, best_zone, best_status, best_img
