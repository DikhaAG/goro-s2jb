from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import numpy as np

def detect_dark_mode(img: Image.Image) -> bool:
    """
    Detects if the image is in Dark Mode by calculating the average luminance.
    Luminance < 110 indicates dark background with light text.
    """
    gray = img.convert("L")
    stat = np.array(gray)
    avg_luminance = np.mean(stat)
    return avg_luminance < 110.0

def preprocess_image(img: Image.Image) -> Image.Image:
    """
    Preprocess image for optimal Tesseract OCR extraction:
    - Converts to grayscale
    - Inverts if dark mode (so text is black on white)
    - Enhances contrast
    - Sharpens edges
    """
    # 1. Convert to grayscale
    gray = img.convert("L")

    # 2. Invert dark mode screenshots to black text on white background
    if detect_dark_mode(img):
        gray = ImageOps.invert(gray)

    # 3. Enhance contrast (1.8x)
    enhancer = ImageEnhance.Contrast(gray)
    contrasted = enhancer.enhance(1.8)

    # 4. Sharpen
    sharpened = contrasted.filter(ImageFilter.SHARPEN)

    return sharpened
