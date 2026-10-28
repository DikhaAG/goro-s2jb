import re
from rapidfuzz import fuzz
from typing import Tuple

def normalize_text(text: str) -> str:
    """
    Normalizes text for robust fuzzy comparison:
    - Lowercase
    - Strip emojis, special characters, and symbols
    - Collapse multiple whitespace characters into single space
    """
    if not text:
        return ""
    # Lowercase
    normalized = text.lower()
    # Remove non-alphanumeric characters except basic spaces
    normalized = re.sub(r"[^\w\s]", " ", normalized, flags=re.UNICODE)
    # Collapse multiple spaces
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized

def determine_zone(score: float) -> Tuple[str, str]:
    """
    Determines tri-zone classification and recommended validation status
    based on PRD Section 4.2 & Task 3:
    - GREEN (score >= 90.0%): APPROVED
    - YELLOW (70.0% <= score < 90.0%): NEEDS_REVIEW
    - RED (score < 70.0%): REJECTED
    """
    if score >= 90.0:
        return "GREEN", "APPROVED"
    elif score >= 70.0:
        return "YELLOW", "NEEDS_REVIEW"
    else:
        return "RED", "REJECTED"

def calculate_similarity(target_name: str, extracted_text: str) -> Tuple[float, str, str]:
    """
    Calculates fuzzy similarity between target reviewer name and extracted OCR text.
    Returns (score, zone, recommended_status).
    """
    norm_target = normalize_text(target_name)
    norm_extracted = normalize_text(extracted_text)

    if not norm_target or not norm_extracted:
        return 0.0, "RED", "REJECTED"

    # Calculate both partial ratio and token set ratio
    score_partial = fuzz.partial_ratio(norm_target, norm_extracted)
    score_token_set = fuzz.token_set_ratio(norm_target, norm_extracted)

    final_score = round(float(max(score_partial, score_token_set)), 2)
    zone, status = determine_zone(final_score)

    return final_score, zone, status
