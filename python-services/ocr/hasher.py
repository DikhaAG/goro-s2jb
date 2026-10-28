from PIL import Image
import imagehash

def calculate_phash(img: Image.Image) -> str:
    """
    Computes a 64-bit DCT-based Perceptual Hash (pHash) and returns a 16-character hex string.
    """
    hash_obj = imagehash.phash(img, hash_size=8)
    return str(hash_obj)

def hamming_distance(hash1: str, hash2: str) -> int:
    """
    Calculates the Hamming distance (number of bit differences) between two 64-bit hex hash strings.
    """
    if not hash1 or not hash2 or len(hash1) != len(hash2):
        return 64  # Maximum bit difference

    val1 = int(hash1, 16)
    val2 = int(hash2, 16)
    xor_val = val1 ^ val2
    return bin(xor_val).count("1")

def is_visual_duplicate(hash1: str, hash2: str, max_distance: int = 5) -> bool:
    """
    Determines if two images are visual duplicates:
    - Distance == 0: Exact identical image
    - 1 <= Distance <= 5: Slightly cropped, recompressed, or minorly altered duplicate
    - Distance > 5: Distinct images
    """
    dist = hamming_distance(hash1, hash2)
    return dist <= max_distance
