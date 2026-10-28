import os
import pytesseract
from PIL import Image
from preprocessor import preprocess_image

# Auto-detect Tesseract binary path
if os.path.exists("/opt/homebrew/bin/tesseract"):
    pytesseract.pytesseract.tesseract_cmd = "/opt/homebrew/bin/tesseract"
elif os.path.exists("/usr/bin/tesseract"):
    pytesseract.pytesseract.tesseract_cmd = "/usr/bin/tesseract"
elif os.path.exists("/usr/local/bin/tesseract"):
    pytesseract.pytesseract.tesseract_cmd = "/usr/local/bin/tesseract"

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
