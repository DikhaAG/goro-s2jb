use crate::hasher::hamming_distance;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::LazyLock;
use strsim::levenshtein;

static RE_DRIVE_ID: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?:/d/|id=|/file/d/|/uc\?id=)([a-zA-Z0-9_-]{25,})").unwrap()
});

static PLAYSTORE_STOPWORDS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    [
        "pln", "mobile", "aplikasi", "ulasan", "anda", "yang", "baru", "terakhir",
        "diupdate", "energikan", "harimu", "dengan", "wajah", "tampilan", "lebih",
        "modern", "navigasi", "mudah", "digunakan", "edit", "dukungan", "ganti",
        "akun", "untuk", "menjadi", "penguji", "beta", "dikaitkan", "lain",
        "mendapatkan", "update", "dahulu", "play", "store", "gabung", "selengkapnya",
        "tentang", "sinergi", "layanan", "kepada", "pelanggan", "melalui", "berbasis",
        "gratis", "populer", "bisnis", "rumah", "griya", "penyedia", "utilitas",
        "dating", "game", "telusuri", "buku", "uninstal", "buka", "rating",
        "bintang", "versi",
    ]
    .into_iter()
    .collect()
});

pub fn extract_google_drive_file_id(url: &str) -> Option<String> {
    if url.is_empty() {
        return None;
    }
    RE_DRIVE_ID
        .captures(url)
        .and_then(|cap| cap.get(1))
        .map(|m| m.as_str().to_string())
}

pub fn calculate_visual_similarity(distance: u32) -> u32 {
    let sim = (1.0 - (distance as f64 / 64.0)) * 100.0;
    sim.round().clamp(0.0, 100.0) as u32
}

pub fn calculate_reviewer_similarity(name_a: Option<&str>, name_b: Option<&str>) -> u32 {
    let s1 = name_a.unwrap_or("").trim().to_lowercase();
    let s2 = name_b.unwrap_or("").trim().to_lowercase();

    if s1 == s2 && !s1.is_empty() {
        return 100;
    }
    if s1.is_empty() || s2.is_empty() {
        return 0;
    }

    let len1 = s1.chars().count();
    let len2 = s2.chars().count();
    let max_len = len1.max(len2);
    let dist = levenshtein(&s1, &s2);

    if dist >= max_len {
        0
    } else {
        (((1.0 - dist as f64 / max_len as f64) * 100.0).round() as u32).min(100)
    }
}

pub fn tokenize_text(text: &str) -> Vec<String> {
    text.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .filter(|w| w.len() > 2)
        .map(|s| s.to_string())
        .collect()
}

pub fn calculate_text_similarity(text_a: Option<&str>, text_b: Option<&str>) -> u32 {
    let raw_a = match text_a {
        Some(t) if !t.is_empty() => tokenize_text(t),
        _ => return 0,
    };
    let raw_b = match text_b {
        Some(t) if !t.is_empty() => tokenize_text(t),
        _ => return 0,
    };

    let filtered_a: Vec<&str> = raw_a
        .iter()
        .map(|s| s.as_str())
        .filter(|w| !PLAYSTORE_STOPWORDS.contains(w))
        .collect();
    let filtered_b: Vec<&str> = raw_b
        .iter()
        .map(|s| s.as_str())
        .filter(|w| !PLAYSTORE_STOPWORDS.contains(w))
        .collect();

    let tokens_a = if !filtered_a.is_empty() {
        filtered_a
    } else {
        raw_a.iter().map(|s| s.as_str()).collect()
    };
    let tokens_b = if !filtered_b.is_empty() {
        filtered_b
    } else {
        raw_b.iter().map(|s| s.as_str()).collect()
    };

    let set_a: HashSet<&str> = tokens_a.into_iter().collect();
    let set_b: HashSet<&str> = tokens_b.into_iter().collect();

    if set_a.is_empty() && set_b.is_empty() {
        return 100;
    }
    if set_a.is_empty() || set_b.is_empty() {
        return 0;
    }

    let intersection = set_a.intersection(&set_b).count();
    let union = set_a.union(&set_b).count();

    if union == 0 {
        0
    } else {
        (((intersection as f64 / union as f64) * 100.0).round() as u32).min(100)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateReview {
    pub id: String,
    pub evidence_image_hash: Option<String>,
    pub duplicate_of_id: Option<String>,
    pub extracted_ocr_text: Option<String>,
    pub playstore_reviewer_name: Option<String>,
    pub evidence_image_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchDuplicateRequest {
    pub review_id: String,
    pub image_hash: String,
    pub threshold: Option<u32>,
    pub extracted_text: Option<String>,
    pub reviewer_name: Option<String>,
    pub evidence_image_path: Option<String>,
    pub candidates: Vec<CandidateReview>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchDuplicateResponse {
    pub is_duplicate: bool,
    pub duplicate_of_id: Option<String>,
    pub min_distance: u32,
    pub visual_similarity: u32,
    pub text_similarity: u32,
    pub reviewer_similarity: u32,
    pub match_reason: Option<String>,
    pub execution_time_ms: u64,
}

/// Evaluates candidates against target review to detect multimodal duplicates
/// with sub-millisecond execution.
pub fn evaluate_batch_duplicate(req: BatchDuplicateRequest) -> BatchDuplicateResponse {
    let start = std::time::Instant::now();
    let threshold = req.threshold.unwrap_or(5);

    if req.image_hash.len() != 16 {
        return BatchDuplicateResponse {
            is_duplicate: false,
            duplicate_of_id: None,
            min_distance: 64,
            visual_similarity: 0,
            text_similarity: 0,
            reviewer_similarity: 0,
            match_reason: None,
            execution_time_ms: start.elapsed().as_millis() as u64,
        };
    }

    let current_drive_id = req
        .evidence_image_path
        .as_deref()
        .and_then(extract_google_drive_file_id);

    let mut min_distance = 64u32;
    let mut best_visual_sim = 0u32;
    let mut best_text_sim = 0u32;
    let mut best_reviewer_sim = 0u32;

    for candidate in &req.candidates {
        let cand_hash = match candidate.evidence_image_hash.as_deref() {
            Some(h) if h.len() == 16 => h,
            _ => continue,
        };

        let distance = hamming_distance(&req.image_hash, cand_hash);
        let visual_sim = calculate_visual_similarity(distance);

        if distance < min_distance {
            min_distance = distance;
            best_visual_sim = visual_sim;
        }

        if distance <= threshold {
            let cand_drive_id = candidate
                .evidence_image_path
                .as_deref()
                .and_then(extract_google_drive_file_id);

            let is_same_drive_id = current_drive_id.is_some()
                && cand_drive_id.is_some()
                && current_drive_id == cand_drive_id;

            let reviewer_sim = calculate_reviewer_similarity(
                req.reviewer_name.as_deref(),
                candidate.playstore_reviewer_name.as_deref(),
            );
            let text_sim = calculate_text_similarity(
                req.extracted_text.as_deref(),
                candidate.extracted_ocr_text.as_deref(),
            );

            best_text_sim_update(&mut best_text_sim, text_sim);
            best_text_sim_update(&mut best_text_sim, text_sim);
            best_reviewer_sim_update(&mut best_reviewer_sim, reviewer_sim);

            let has_reviewer_info = req.reviewer_name.as_deref().is_some_and(|s| !s.trim().is_empty())
                && candidate.playstore_reviewer_name.as_deref().is_some_and(|s| !s.trim().is_empty());
            let has_text_info = req.extracted_text.as_deref().is_some_and(|s| !s.trim().is_empty())
                && candidate.extracted_ocr_text.as_deref().is_some_and(|s| !s.trim().is_empty());
            let has_differentiating_info = has_reviewer_info || has_text_info;

            let (is_true_duplicate, match_reason) = if is_same_drive_id {
                (true, "Berkas Eviden Identik")
            } else if has_differentiating_info {
                if has_reviewer_info && reviewer_sim >= 75 {
                    (true, "Nama Pengulas & Visual Identik")
                } else if has_text_info && text_sim >= 70 {
                    (true, "Teks Ulasan & Visual Identik")
                } else {
                    // Visual template collision dismissed! Different reviewer name / content.
                    (false, "")
                }
            } else {
                (true, "Citra Visual Identik")
            };

            if is_true_duplicate {
                let root_master_id = candidate
                    .duplicate_of_id
                    .clone()
                    .unwrap_or_else(|| candidate.id.clone());

                return BatchDuplicateResponse {
                    is_duplicate: true,
                    duplicate_of_id: Some(root_master_id),
                    min_distance: distance,
                    visual_similarity: visual_sim,
                    text_similarity: text_sim,
                    reviewer_similarity: reviewer_sim,
                    match_reason: Some(match_reason.to_string()),
                    execution_time_ms: start.elapsed().as_millis() as u64,
                };
            }
        }
    }

    BatchDuplicateResponse {
        is_duplicate: false,
        duplicate_of_id: None,
        min_distance,
        visual_similarity: best_visual_sim,
        text_similarity: best_text_sim,
        reviewer_similarity: best_reviewer_sim,
        match_reason: None,
        execution_time_ms: start.elapsed().as_millis() as u64,
    }
}

fn best_text_sim_update(current: &mut u32, new_val: u32) {
    if new_val > *current {
        *current = new_val;
    }
}

fn best_reviewer_sim_update(current: &mut u32, new_val: u32) {
    if new_val > *current {
        *current = new_val;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_google_drive_file_id() {
        let url = "https://drive.google.com/uc?id=1AbC_defGHIjklmNOPqrsTUVwxYZ12345&export=download";
        assert_eq!(
            extract_google_drive_file_id(url),
            Some("1AbC_defGHIjklmNOPqrsTUVwxYZ12345".to_string())
        );
    }

    #[test]
    fn test_template_collision_dismissal() {
        // Same visual template (distance 2), but completely different reviewer name and text
        let req = BatchDuplicateRequest {
            review_id: "rev-1".to_string(),
            image_hash: "aa853f6a4a5af207".to_string(),
            threshold: Some(5),
            extracted_text: Some("Layanan cepat sekali terima kasih".to_string()),
            reviewer_name: Some("Budi Santoso".to_string()),
            evidence_image_path: Some("https://drive.google.com/uc?id=file1".to_string()),
            candidates: vec![CandidateReview {
                id: "rev-2".to_string(),
                evidence_image_hash: Some("aa853f6a4a5af206".to_string()), // distance 1
                duplicate_of_id: None,
                extracted_ocr_text: Some("Sering mati lampu tolong diperbaiki".to_string()),
                playstore_reviewer_name: Some("Siti Aminah".to_string()),
                evidence_image_path: Some("https://drive.google.com/uc?id=file2".to_string()),
            }],
        };

        let res = evaluate_batch_duplicate(req);
        // Should NOT be flagged as duplicate due to different reviewer name and review text!
        assert!(!res.is_duplicate);
    }

    #[test]
    fn test_identical_reviewer_and_hash_is_duplicate() {
        let req = BatchDuplicateRequest {
            review_id: "rev-1".to_string(),
            image_hash: "aa853f6a4a5af207".to_string(),
            threshold: Some(5),
            extracted_text: Some("Layanan mantap PLN".to_string()),
            reviewer_name: Some("Budi Santoso".to_string()),
            evidence_image_path: Some("https://drive.google.com/uc?id=file1".to_string()),
            candidates: vec![CandidateReview {
                id: "rev-master".to_string(),
                evidence_image_hash: Some("aa853f6a4a5af207".to_string()), // distance 0
                duplicate_of_id: None,
                extracted_ocr_text: Some("Layanan mantap PLN".to_string()),
                playstore_reviewer_name: Some("Budi Santoso".to_string()),
                evidence_image_path: Some("https://drive.google.com/uc?id=file_different".to_string()),
            }],
        };

        let res = evaluate_batch_duplicate(req);
        assert!(res.is_duplicate);
        assert_eq!(res.duplicate_of_id, Some("rev-master".to_string()));
    }
}
