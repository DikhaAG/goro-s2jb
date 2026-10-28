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

def extract_text_from_image(img: Image.Image) -> str:
    """
    Runs image preprocessing and extracts text using Tesseract OCR
    with Indonesian + English language models.
    """
    processed = preprocess_image(img)
    try:
        text = pytesseract.image_to_string(processed, lang="ind+eng").strip()
    except Exception:
        # Fallback to English if Indonesian language pack isn't present
        text = pytesseract.image_to_string(processed, lang="eng").strip()

    return text
