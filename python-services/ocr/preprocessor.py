from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import numpy as np

def normalize_dimensions(img: Image.Image, max_dimension: int = 1920) -> Image.Image:
    """
    Scales down excessively large camera photos (> 1920px) while maintaining aspect ratio
    and preserving character sharpness for fast, robust OCR processing.
    """
    w, h = img.size
    if max(w, h) > max_dimension:
        ratio = max_dimension / max(w, h)
        new_w = int(w * ratio)
        new_h = int(h * ratio)
        return img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    return img

def normalize_orientation(img: Image.Image) -> Image.Image:
    """
    Normalizes image orientation based on EXIF orientation metadata tags.
    Corrects photos taken on smartphone and tablet cameras (e.g. Samsung SM-X200, iPhones)
    where portrait shots are stored as raw landscape with EXIF orientation 6 or 8.
    Also caps oversized camera captures (> 1920px) to prevent OCR buffer timeouts.
    """
    try:
        transposed = ImageOps.exif_transpose(img)
        base = transposed if transposed is not None else img
    except Exception:
        base = img
    return normalize_dimensions(base)

def detect_dark_mode(img: Image.Image) -> bool:
    """
    Detects if the image is in Dark Mode by calculating average luminance.
    Luminance < 110 indicates dark background with light text.
    """
    gray = img.convert("L")
    stat = np.array(gray)
    avg_luminance = np.mean(stat)
    return avg_luminance < 110.0

def enhance_for_screen_photo(img: Image.Image) -> Image.Image:
    """
    Specialized enhancement for photos of physical phone/tablet screens:
    - Autocontrast with cutoff to eliminate glare, reflections, and backlight haze
    - Unsharp mask to de-blur soft focus and camera shake
    - Contrast boost to sharpen text edges against LCD pixel grids
    """
    gray = img.convert("L")
    # 1. Expand histogram range across full 0-255 spectrum
    auto = ImageOps.autocontrast(gray, cutoff=2)
    # 2. De-blur using unsharp mask
    unsharp = auto.filter(ImageFilter.UnsharpMask(radius=2, percent=175, threshold=3))
    # 3. Boost contrast
    enhancer = ImageEnhance.Contrast(unsharp)
    contrasted = enhancer.enhance(1.6)
    return contrasted

def denoise_screen_cracks(img: Image.Image) -> Image.Image:
    """
    Suppresses physical screen scratches, glass crack lines, and moire interference patterns.
    Uses median filter to eliminate thin 1-2px crack spikes without eroding character strokes.
    """
    gray = img.convert("L")
    # Median filter suppresses thin crack spikes and moire noise
    median = gray.filter(ImageFilter.MedianFilter(size=3))
    # Autocontrast to restore crispness
    auto = ImageOps.autocontrast(median, cutoff=2)
    # Sharpen character boundaries
    sharpened = auto.filter(ImageFilter.SHARPEN)
    return sharpened

def preprocess_image(img: Image.Image) -> Image.Image:
    """
    Comprehensive preprocessing for Tesseract OCR:
    - Normalizes orientation
    - Converts to grayscale
    - Inverts dark mode screenshots (black text on white background)
    - Enhances contrast and sharpens
    """
    oriented = normalize_orientation(img)
    gray = oriented.convert("L")

    # Invert dark mode screenshots to black text on white background
    if detect_dark_mode(oriented):
        gray = ImageOps.invert(gray)

    # Autocontrast
    auto = ImageOps.autocontrast(gray, cutoff=1)

    # Enhance contrast (1.8x)
    enhancer = ImageEnhance.Contrast(auto)
    contrasted = enhancer.enhance(1.8)

    # Sharpen
    sharpened = contrasted.filter(ImageFilter.SHARPEN)
    return sharpened
