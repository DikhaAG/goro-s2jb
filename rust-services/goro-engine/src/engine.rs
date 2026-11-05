use crate::matcher::calculate_similarity;
use crate::preprocessor::{
    denoise_screen_cracks, enhance_for_screen_photo, normalize_dimensions, preprocess_image,
};
use crate::tesseract_ffi::{TessPageSegMode, TesseractEngine};
use image::{imageops, DynamicImage, GrayImage};
use std::collections::HashSet;

/// Runs raw OCR recognition on a single grayscale image using warm in-memory Tesseract engine.
fn ocr_single_pass(
    engine: &mut TesseractEngine,
    gray: &GrayImage,
    psm: Option<TessPageSegMode>,
) -> String {
    if let Some(mode) = psm {
        engine.set_page_seg_mode(mode);
    } else {
        engine.set_page_seg_mode(TessPageSegMode::Auto);
    }

    let raw_bytes = gray.as_raw();
    engine.set_image(raw_bytes, gray.width(), gray.height(), 1);
    engine.get_utf8_text().unwrap_or_default()
}

/// Multi-pass OCR extraction optimized for mobile screenshots and physical screen photos:
/// - Pass 1: Raw normalized image (preserves clean anti-aliasing)
/// - Pass 2: Screen photo enhancement (de-blur + autocontrast for reflections & camera blur)
/// - Pass 3: Denoised screen cracks (median filter suppressing scratch lines)
/// - Pass 4: Preprocessed / inverted dark mode image
/// - Pass 5: PSM 6 (Single uniform block of text)
pub fn extract_text_from_image(engine: &mut TesseractEngine, img: &DynamicImage) -> String {
    let normalized = normalize_dimensions(img.clone());
    let gray_raw = normalized.to_luma8();

    let mut extracted_parts = Vec::new();
    let mut seen_lines = HashSet::new();

    let mut add_lines = |text: String| {
        for line in text.lines() {
            let cleaned = line.trim();
            if !cleaned.is_empty() && seen_lines.insert(cleaned.to_string()) {
                extracted_parts.push(cleaned.to_string());
            }
        }
    };

    // Pass 1: Clean raw grayscale
    let pass1 = ocr_single_pass(engine, &gray_raw, None);
    add_lines(pass1);

    // Pass 2: Enhanced screen photo
    let enhanced = enhance_for_screen_photo(&normalized).to_luma8();
    let pass2 = ocr_single_pass(engine, &enhanced, None);
    add_lines(pass2);

    // Pass 3: Denoised screen cracks
    let denoised = denoise_screen_cracks(&normalized).to_luma8();
    let pass3 = ocr_single_pass(engine, &denoised, None);
    add_lines(pass3);

    // Pass 4: Preprocessed inverted image
    let processed = preprocess_image(&normalized).to_luma8();
    let pass4 = ocr_single_pass(engine, &processed, None);
    add_lines(pass4);

    // Pass 5: PSM 6 (Single uniform block of text) on raw and enhanced
    let pass5 = ocr_single_pass(engine, &gray_raw, Some(TessPageSegMode::SingleBlock));
    add_lines(pass5);

    extracted_parts.join("\n").trim().to_string()
}

/// Extracts text and automatically resolves orientation even if EXIF metadata is missing.
/// If primary orientation yields a score < 90%, tests 270, 180, and 90 degree rotations.
/// Returns (extracted_text, similarity_score, zone, recommended_status, best_oriented_image).
pub fn extract_text_with_auto_orientation(
    engine: &mut TesseractEngine,
    img: &DynamicImage,
    target_name: &str,
) -> (String, f64, &'static str, &'static str, DynamicImage) {
    let oriented = normalize_dimensions(img.clone());

    // 1. Primary orientation extraction
    let primary_text = extract_text_from_image(engine, &oriented);
    let (score, zone, status) = calculate_similarity(target_name, &primary_text);

    // If already high confidence (Green zone >= 90%) or no target name provided, return immediately
    if score >= 90.0 || target_name.trim().is_empty() {
        return (primary_text, score, zone, status, oriented);
    }

    // 2. Orientation fallback: photo may be rotated sideways or upside-down
    let mut best_text = primary_text;
    let mut best_score = score;
    let mut best_zone = zone;
    let mut best_status = status;
    let mut best_img = oriented.clone();

    // Test 270 deg (most common for smartphone portrait shots stored as landscape), then 180 and 90
    let rotations = [
        (270, imageops::rotate270(&oriented)),
        (180, imageops::rotate180(&oriented)),
        (90, imageops::rotate90(&oriented)),
    ];

    for (_angle, rot_buf) in rotations {
        let rot_dynamic = DynamicImage::ImageRgba8(rot_buf);
        let rot_text = extract_text_from_image(engine, &rot_dynamic);
        let (rot_score, rot_zone, rot_status) = calculate_similarity(target_name, &rot_text);

        if rot_score > best_score {
            best_text = rot_text;
            best_score = rot_score;
            best_zone = rot_zone;
            best_status = rot_status;
            best_img = rot_dynamic;

            // Early exit if Green Zone achieved
            if rot_score >= 90.0 {
                break;
            }
        }
    }

    (best_text, best_score, best_zone, best_status, best_img)
}

