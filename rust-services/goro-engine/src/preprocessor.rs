use image::{imageops, DynamicImage, GrayImage, Luma};

const MAX_DIMENSION: u32 = 1920;

/// Scales down excessively large camera photos (> 1920px) while maintaining aspect ratio
/// and preserving character sharpness for fast, robust OCR processing.
pub fn normalize_dimensions(img: DynamicImage) -> DynamicImage {
    let (w, h) = (img.width(), img.height());
    let max_dim = w.max(h);
    if max_dim > MAX_DIMENSION {
        let ratio = MAX_DIMENSION as f64 / max_dim as f64;
        let new_w = (w as f64 * ratio).round() as u32;
        let new_h = (h as f64 * ratio).round() as u32;
        img.resize(new_w, new_h, imageops::FilterType::Lanczos3)
    } else {
        img
    }
}

/// Detects if the image is in Dark Mode by calculating average luminance.
/// Luminance < 110.0 indicates dark background with light text.
pub fn detect_dark_mode(img: &DynamicImage) -> bool {
    let gray = img.to_luma8();
    let total_pixels = gray.width() as u64 * gray.height() as u64;
    if total_pixels == 0 {
        return false;
    }
    let sum: u64 = gray.pixels().map(|p| p[0] as u64).sum();
    let avg = sum as f64 / total_pixels as f64;
    avg < 110.0
}

/// Stretches pixel histogram across full 0-255 spectrum with a percentile cutoff.
pub fn autocontrast(gray: &GrayImage, cutoff_percent: f64) -> GrayImage {
    let total = (gray.width() * gray.height()) as f64;
    if total == 0.0 {
        return gray.clone();
    }

    // Build histogram
    let mut hist = [0u32; 256];
    for p in gray.pixels() {
        hist[p[0] as usize] += 1;
    }

    let cutoff_count = (total * (cutoff_percent / 100.0)).round() as u32;

    // Find low cutoff: smallest pixel value where cumulative count > cutoff_count
    let mut low = 0usize;
    let mut count = 0u32;
    for (i, &c) in hist.iter().enumerate() {
        count += c;
        if count > cutoff_count {
            low = i;
            break;
        }
    }

    // Find high cutoff: largest pixel value where cumulative count > cutoff_count
    let mut high = 255usize;
    count = 0;
    for (i, &c) in hist.iter().enumerate().rev() {
        count += c;
        if count > cutoff_count {
            high = i;
            break;
        }
    }

    if high <= low {
        return gray.clone();
    }

    let mut out = GrayImage::new(gray.width(), gray.height());
    let range = (high - low) as f64;

    for (x, y, p) in gray.enumerate_pixels() {
        let val = p[0] as usize;
        let stretched = if val <= low {
            0u8
        } else if val >= high {
            255u8
        } else {
            (((val - low) as f64 / range) * 255.0).clamp(0.0, 255.0) as u8
        };
        out.put_pixel(x, y, Luma([stretched]));
    }

    out
}

/// Applies a 3x3 median filter to eliminate thin 1-2px crack spikes, screen scratches,
/// and moire noise patterns without eroding character strokes.
pub fn median_filter_3x3(gray: &GrayImage) -> GrayImage {
    let (w, h) = (gray.width(), gray.height());
    if w < 3 || h < 3 {
        return gray.clone();
    }

    let mut out = GrayImage::new(w, h);

    for y in 0..h {
        for x in 0..w {
            if x == 0 || y == 0 || x == w - 1 || y == h - 1 {
                out.put_pixel(x, y, *gray.get_pixel(x, y));
                continue;
            }

            let mut neighbors = [0u8; 9];
            let mut idx = 0;
            for dy in [y - 1, y, y + 1] {
                for dx in [x - 1, x, x + 1] {
                    neighbors[idx] = gray.get_pixel(dx, dy)[0];
                    idx += 1;
                }
            }

            neighbors.sort_unstable();
            out.put_pixel(x, y, Luma([neighbors[4]]));
        }
    }

    out
}

/// Inverts colors of grayscale image (e.g. for Dark Mode to make text black on white).
pub fn invert_luma(gray: &GrayImage) -> GrayImage {
    let mut out = GrayImage::new(gray.width(), gray.height());
    for (x, y, p) in gray.enumerate_pixels() {
        out.put_pixel(x, y, Luma([255 - p[0]]));
    }
    out
}

/// Enhances screen photo (autocontrast + unsharp de-blurring).
pub fn enhance_for_screen_photo(img: &DynamicImage) -> DynamicImage {
    let gray = img.to_luma8();
    let auto = autocontrast(&gray, 2.0);
    // Unsharp mask approximation using gentle gaussian blur subtraction
    let blurred = imageops::blur(&auto, 1.5);
    let mut unsharp = GrayImage::new(auto.width(), auto.height());

    for (x, y, p) in auto.enumerate_pixels() {
        let orig = p[0] as f64;
        let blur_val = blurred.get_pixel(x, y)[0] as f64;
        let enhanced = (orig + 1.2 * (orig - blur_val)).clamp(0.0, 255.0) as u8;
        unsharp.put_pixel(x, y, Luma([enhanced]));
    }

    let contrasted = autocontrast(&unsharp, 1.0);
    DynamicImage::ImageLuma8(contrasted)
}

/// Denoises screen cracks using 3x3 median filtering and boundary sharpening.
pub fn denoise_screen_cracks(img: &DynamicImage) -> DynamicImage {
    let gray = img.to_luma8();
    let denoised = median_filter_3x3(&gray);
    let auto = autocontrast(&denoised, 2.0);
    DynamicImage::ImageLuma8(auto)
}

/// Comprehensive preprocessing pipeline for Tesseract OCR:
/// - Normalizes dimensions (<= 1920px)
/// - Converts to grayscale
/// - Inverts Dark Mode screenshots (white text on dark bg -> black on white)
/// - Autocontrast histogram stretching
pub fn preprocess_image(img: &DynamicImage) -> DynamicImage {
    let normalized = normalize_dimensions(img.clone());
    let mut gray = normalized.to_luma8();

    if detect_dark_mode(&normalized) {
        gray = invert_luma(&gray);
    }

    let auto = autocontrast(&gray, 1.5);
    DynamicImage::ImageLuma8(auto)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};

    #[test]
    fn test_normalize_dimensions_downscaling() {
        let large = DynamicImage::ImageRgb8(RgbImage::new(2400, 1600));
        let normalized = normalize_dimensions(large);
        assert!(normalized.width() <= MAX_DIMENSION);
        assert!(normalized.height() <= MAX_DIMENSION);
        assert_eq!(normalized.width(), MAX_DIMENSION);
    }

    #[test]
    fn test_normalize_dimensions_small_noop() {
        let small = DynamicImage::ImageRgb8(RgbImage::new(800, 600));
        let normalized = normalize_dimensions(small);
        assert_eq!(normalized.width(), 800);
        assert_eq!(normalized.height(), 600);
    }

    #[test]
    fn test_detect_dark_mode() {
        // Dark image: black pixels
        let mut dark = RgbImage::new(100, 100);
        for p in dark.pixels_mut() {
            *p = Rgb([20, 20, 20]);
        }
        assert!(detect_dark_mode(&DynamicImage::ImageRgb8(dark)));

        // Light image: white pixels
        let mut light = RgbImage::new(100, 100);
        for p in light.pixels_mut() {
            *p = Rgb([240, 240, 240]);
        }
        assert!(!detect_dark_mode(&DynamicImage::ImageRgb8(light)));
    }

    #[test]
    fn test_autocontrast_stretches_values() {
        let mut gray = GrayImage::new(10, 10);
        for p in gray.pixels_mut() {
            *p = Luma([100]); // Flat grey
        }
        gray.put_pixel(0, 0, Luma([50]));
        gray.put_pixel(9, 9, Luma([150]));

        let stretched = autocontrast(&gray, 0.0);
        assert_eq!(stretched.get_pixel(0, 0)[0], 0);
        assert_eq!(stretched.get_pixel(9, 9)[0], 255);
    }

    #[test]
    fn test_median_filter_removes_salt_and_pepper_scratch() {
        let mut gray = GrayImage::new(5, 5);
        for p in gray.pixels_mut() {
            *p = Luma([128]);
        }
        // Artificial scratch spike
        gray.put_pixel(2, 2, Luma([255]));

        let filtered = median_filter_3x3(&gray);
        // Scratch spike should be completely eliminated back to 128
        assert_eq!(filtered.get_pixel(2, 2)[0], 128);
    }
}
