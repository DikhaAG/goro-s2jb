import os
import pytesseract
from PIL import Image
from preprocessor import preprocess_image

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
    Runs dual-pass OCR extraction:
    - Pass 1: Raw image with Indonesian + English models (preserves clean anti-aliased font kerning)
    - Pass 2: Inverted/preprocessed image for Dark Mode or low-contrast screenshots
    - Fallback: Multi-segmentation PSM 6/11 for sparse/block layouts
    """
    lang = "ind+eng"

    extracted_parts = []

    # Pass 1: Clean raw image
    try:
        t_raw = pytesseract.image_to_string(img, lang=lang).strip()
        if t_raw:
            extracted_parts.append(t_raw)
    except Exception:
        try:
            t_raw = pytesseract.image_to_string(img, lang="eng").strip()
            if t_raw:
                extracted_parts.append(t_raw)
        except Exception:
            pass

    # Pass 2: Preprocessed image (handles Dark Mode inversion & edge enhancement)
    try:
        processed = preprocess_image(img)
        t_proc = pytesseract.image_to_string(processed, lang=lang).strip()
        if t_proc and t_proc != (extracted_parts[0] if extracted_parts else ""):
            extracted_parts.append(t_proc)
    except Exception:
        pass

    # Pass 3: PSM 6 (Single uniform block of text)
    # Crucial for Play Store mobile review cards where reviewer name sits beside stars/icons
    # and is frequently skipped by PSM 3 automatic page segmentation.
    try:
        t_psm6 = pytesseract.image_to_string(img, lang=lang, config="--psm 6").strip()
        if t_psm6 and t_psm6 not in extracted_parts:
            extracted_parts.append(t_psm6)
    except Exception:
        try:
            t_psm6 = pytesseract.image_to_string(img, lang="eng", config="--psm 6").strip()
            if t_psm6 and t_psm6 not in extracted_parts:
                extracted_parts.append(t_psm6)
        except Exception:
            pass

    # Combine all passes
    combined = "\n".join(extracted_parts).strip()

    return combined

