import re
from rapidfuzz import fuzz
from rapidfuzz.distance import Levenshtein
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
    Handles physical screen defects (cracked screens, blur, moire artifacts):
    1. Full text standard partial ratio and token set ratio
    2. Line-by-line inspection matching Play Store reviewer layout
    3. Space-collapsed matching for physical cracks cutting words (e.g. 'Tom my' -> 'Tommy')
    4. Optical character confusion normalization (0 <-> o, 1 <-> i/l, rn <-> m, vv <-> w)
    5. Single-character Levenshtein distance tolerance for short names (e.g. 'Tiara' vs 'Tara')
    6. Exact token match for multi-word names without conflicting reviewer name (e.g. 'Azkia keysah' vs 'Keysah')
    7. Prefix and nickname matching (e.g. 'DICKI' vs 'dickyyuhendra yhd')
    8. Multi-word sliding window across adjacent word tokens
    Returns (score, zone, recommended_status).
    """
    norm_target = normalize_text(target_name)
    norm_extracted = normalize_text(extracted_text)

    if not norm_target or not norm_extracted:
        return 0.0, "RED", "REJECTED"

    target_words = norm_target.split()
    target_no_space = norm_target.replace(" ", "")
    lines = [l.strip().lower() for l in extracted_text.splitlines() if l.strip()]

    scores = []

    # 1. Standard full-text matching (only partial_ratio if extracted text is at least as long as target)
    if len(norm_extracted) >= len(norm_target):
        scores.append(fuzz.partial_ratio(norm_target, norm_extracted))
    scores.append(fuzz.token_set_ratio(norm_target, norm_extracted))

    # Minimum length threshold to prevent single-character noise lines from falsely triggering partial matches
    min_len = max(3, int(len(target_no_space) * 0.6))

    # UI stopwords commonly found in mobile store cards to exclude from conflicting token check
    ui_stopwords = {
        "bintang", "ulasan", "diedit", "edit", "anda", "bantu", "apakah", "ya", "tidak",
        "terima", "kasih", "pln", "mobile", "rating", "download", "ponsel", "desktop",
        "terakhir", "diupdate", "lihat", "semua", "developer", "balasan"
    }

    # 2. Line-by-line review card matching
    for line in lines:
        norm_line = normalize_text(line)
        line_no_space = norm_line.replace(" ", "")

        # Skip noise lines shorter than 60% of the target name
        if len(line_no_space) < min_len:
            continue

        scores.append(fuzz.ratio(norm_target, norm_line))
        if len(norm_line) >= len(norm_target):
            scores.append(fuzz.partial_ratio(norm_target, norm_line))

        # Space-collapsed matching for screen cracks splitting characters (e.g. 'Tom my')
        if target_no_space in line_no_space:
            scores.append(100.0)
        elif len(line_no_space) >= len(target_no_space):
            scores.append(fuzz.partial_ratio(target_no_space, line_no_space))

        # Optical character substitution normalization for cracked/blurry screens
        # (0 <-> o, 1 <-> i, 5 <-> s, 8 <-> b, rn <-> m, vv <-> w)
        sub_map = str.maketrans({"0": "o", "1": "i", "5": "s", "8": "b"})
        target_sub = target_no_space.translate(sub_map)
        line_clean = re.sub(r"[^\w]", "", line.lower()).translate(sub_map)
        line_clean = line_clean.replace("rn", "m").replace("vv", "w")

        if len(line_clean) >= min_len:
            if target_sub in line_clean:
                scores.append(95.0)
            elif len(line_clean) >= len(target_sub):
                scores.append(fuzz.partial_ratio(target_sub, line_clean))

        line_words = [w for w in norm_line.split() if len(w) >= 2]

        # 3. Single-character Levenshtein distance tolerance for short names (e.g. 'Tiara' vs 'Tara')
        # Handles OCR camera blur or screen crack dropping a single character in a 4-6 letter name
        if len(target_no_space) in [4, 5, 6]:
            for w in line_words:
                if len(w) in [len(target_no_space) - 1, len(target_no_space), len(target_no_space) + 1]:
                    if Levenshtein.distance(target_no_space, w) <= 1:
                        scores.append(92.0)

        # 4. Token subset match for multi-word names when no conflicting reviewer name is present
        # (e.g. 'Azkia keysah' on form vs review card displaying only 'Keysah')
        if len(target_words) > 1 and len(line_words) >= 1:
            matching_tokens = [
                w for w in line_words
                if any(w == tw or (len(w) >= 4 and len(tw) >= 4 and Levenshtein.distance(w, tw) <= 1)
                       for tw in target_words)
            ]
            conflicting_tokens = [
                w for w in line_words
                if not any(w == tw or (len(w) >= 4 and len(tw) >= 4 and Levenshtein.distance(w, tw) <= 1)
                           for tw in target_words)
            ]
            real_conflicts = [w for w in conflicting_tokens if w not in ui_stopwords]

            if matching_tokens and not real_conflicts:
                max_tok_len = max(len(w) for w in matching_tokens)
                if max_tok_len >= 4:
                    scores.append(92.0)

        # 5. Prefix and nickname matching (e.g. 'DICKI' vs 'dickyyuhendra yhd')
        # Accounts for Indonesian name conventions where nicknames or compound words are used
        if len(target_no_space) >= 4:
            t_norm_ending = target_no_space[:-1] + (
                "y" if target_no_space.endswith("i")
                else ("i" if target_no_space.endswith("y") else target_no_space[-1])
            )
            for w in line_words:
                if w.startswith(target_no_space) or w.startswith(t_norm_ending):
                    scores.append(92.0)
                elif len(target_no_space) >= 5 and len(w) >= len(target_no_space) and Levenshtein.distance(target_no_space, w[:len(target_no_space)]) <= 1:
                    scores.append(92.0)

    # 6. Multi-word sliding window for multi-word reviewer names
    words = norm_extracted.split()
    if len(target_words) > 1 and len(words) >= len(target_words):
        k = len(target_words)
        for i in range(len(words) - k + 1):
            window = " ".join(words[i : i + k])
            scores.append(fuzz.ratio(norm_target, window))

    final_score = round(float(min(100.0, max(scores))), 2)
    zone, status = determine_zone(final_score)

    return final_score, zone, status
