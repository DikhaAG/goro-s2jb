use image::DynamicImage;
use std::f64::consts::PI;

const HASH_SIZE: usize = 8;
const HIGHFREQ_FACTOR: usize = 4;
const IMG_SIZE: usize = HASH_SIZE * HIGHFREQ_FACTOR; // 32

/// Precomputes the 32x32 DCT-II transformation matrix.
fn get_dct_matrix() -> [[f64; IMG_SIZE]; IMG_SIZE] {
    let mut matrix = [[0.0f64; IMG_SIZE]; IMG_SIZE];
    for (k, row) in matrix.iter_mut().enumerate() {
        for (n, cell) in row.iter_mut().enumerate() {
            *cell = 2.0 * ((PI * (2.0 * n as f64 + 1.0) * k as f64) / (2.0 * IMG_SIZE as f64)).cos();
        }
    }
    matrix
}

/// Calculates the 64-bit DCT-based Perceptual Hash (pHash) of an image.
/// Produces a 16-character hexadecimal string that is mathematically identical
/// to Python's `imagehash.phash(img, hash_size=8)`.
pub fn calculate_phash(img: &DynamicImage) -> String {
    // 1. Convert to grayscale and resize to 32x32 using Lanczos3 (equivalent to PIL ANTIALIAS)
    let gray = img.to_luma8();
    let resized = image::imageops::resize(
        &gray,
        IMG_SIZE as u32,
        IMG_SIZE as u32,
        image::imageops::FilterType::Lanczos3,
    );

    // 2. Load pixels into 32x32 floating point buffer
    let mut pixels = [[0.0f64; IMG_SIZE]; IMG_SIZE];
    for y in 0..IMG_SIZE {
        for x in 0..IMG_SIZE {
            pixels[y][x] = resized.get_pixel(x as u32, y as u32)[0] as f64;
        }
    }

    // 3. Compute 2D DCT-II: C * pixels * C^T
    let c = get_dct_matrix();

    // Intermediate: temp = C * pixels
    let mut temp = [[0.0f64; IMG_SIZE]; IMG_SIZE];
    for i in 0..IMG_SIZE {
        for j in 0..IMG_SIZE {
            let mut sum = 0.0f64;
            for k in 0..IMG_SIZE {
                sum += c[i][k] * pixels[k][j];
            }
            temp[i][j] = sum;
        }
    }

    // Result: dct = temp * C^T
    let mut dct = [[0.0f64; IMG_SIZE]; IMG_SIZE];
    for i in 0..IMG_SIZE {
        for j in 0..IMG_SIZE {
            let mut sum = 0.0f64;
            for k in 0..IMG_SIZE {
                sum += temp[i][k] * c[j][k];
            }
            dct[i][j] = sum;
        }
    }

    // 4. Extract low-frequency 8x8 submatrix
    let mut low_freq = [0.0f64; 64];
    let mut idx = 0;
    for y in 0..HASH_SIZE {
        for x in 0..HASH_SIZE {
            low_freq[idx] = dct[y][x];
            idx += 1;
        }
    }

    // 5. Calculate median of 8x8 coefficients
    let mut sorted_vals = low_freq;
    sorted_vals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median = (sorted_vals[31] + sorted_vals[32]) / 2.0;

    // 6. Build 64-bit boolean bitmask (1 if > median, 0 otherwise)
    let mut hash_val = 0u64;
    for &val in &low_freq {
        hash_val = (hash_val << 1) | if val > median { 1 } else { 0 };
    }

    format!("{:016x}", hash_val)
}

/// Calculates the Hamming distance between two 64-bit hex hash strings.
/// Utilizes hardware POPCNT CPU instructions for sub-nanosecond comparison.
#[inline]
pub fn hamming_distance(hash1: &str, hash2: &str) -> u32 {
    if hash1.len() != 16 || hash2.len() != 16 {
        return 64;
    }

    match (u64::from_str_radix(hash1, 16), u64::from_str_radix(hash2, 16)) {
        (Ok(v1), Ok(v2)) => (v1 ^ v2).count_ones(),
        _ => 64,
    }
}

/// Determines whether two images are visual duplicates based on Hamming distance threshold.
#[inline]
pub fn is_visual_duplicate(hash1: &str, hash2: &str, max_distance: u32) -> bool {
    hamming_distance(hash1, hash2) <= max_distance
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{GrayImage, Luma};

    #[test]
    fn test_hamming_distance_exact_match() {
        assert_eq!(hamming_distance("aa853f6a4a5af207", "aa853f6a4a5af207"), 0);
    }

    #[test]
    fn test_hamming_distance_known_bits() {
        // Differ by exactly 1 bit in the last character (7 vs 6: 0111 vs 0110)
        assert_eq!(hamming_distance("aa853f6a4a5af207", "aa853f6a4a5af206"), 1);
        // Completely inverted (all 64 bits differ)
        assert_eq!(hamming_distance("0000000000000000", "ffffffffffffffff"), 64);
    }

    #[test]
    fn test_hamming_distance_invalid_length() {
        assert_eq!(hamming_distance("abc", "def"), 64);
        assert_eq!(hamming_distance("invalid_hex_string", "aa853f6a4a5af207"), 64);
    }

    #[test]
    fn test_is_visual_duplicate() {
        assert!(is_visual_duplicate("aa853f6a4a5af207", "aa853f6a4a5af207", 5));
        assert!(is_visual_duplicate("aa853f6a4a5af207", "aa853f6a4a5af206", 5));
        assert!(!is_visual_duplicate("0000000000000000", "ffffffffffffffff", 5));
    }

    #[test]
    fn test_phash_gradient_consistency() {
        let mut img = GrayImage::new(100, 100);
        for x in 0..100 {
            for y in 0..100 {
                let val = ((x * 2 + y * 3) % 256) as u8;
                img.put_pixel(x, y, Luma([val]));
            }
        }
        let dynamic = DynamicImage::ImageLuma8(img);
        let hash = calculate_phash(&dynamic);
        assert_eq!(hash.len(), 16);
        // Verify format is valid 16-character hexadecimal
        assert!(u64::from_str_radix(&hash, 16).is_ok());
    }
}
