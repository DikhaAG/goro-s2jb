use regex::Regex;
use std::collections::HashSet;
use std::sync::LazyLock;
use strsim::levenshtein;

static RE_NON_ALPHANUMERIC: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[^\w\s]").unwrap());
static RE_WHITESPACE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\s+").unwrap());

/// Normalizes text for robust fuzzy comparison:
/// - Lowercase
/// - Strip emojis, punctuation, and non-alphanumeric unicode characters
/// - Collapse multiple whitespace characters into single space
pub fn normalize_text(text: &str) -> String {
    if text.is_empty() {
        return String::new();
    }
    let lower = text.to_lowercase();
    let cleaned = RE_NON_ALPHANUMERIC.replace_all(&lower, " ");
    let collapsed = RE_WHITESPACE.replace_all(&cleaned, " ");
    collapsed.trim().to_string()
}

/// Calculates Longest Common Subsequence (LCS) length between two char slices
pub fn lcs_length(s1: &[char], s2: &[char]) -> usize {
    let m = s1.len();
    let n = s2.len();
    if m == 0 || n == 0 {
        return 0;
    }
    let mut prev = vec![0usize; n + 1];
    let mut curr = vec![0usize; n + 1];

    for i in 1..=m {
        for j in 1..=n {
            if s1[i - 1] == s2[j - 1] {
                curr[j] = prev[j - 1] + 1;
            } else {
                curr[j] = prev[j].max(curr[j - 1]);
            }
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[n]
}

/// Standard Indel similarity ratio (0.0 to 100.0), identical to RapidFuzz fuzz.ratio
pub fn fuzz_ratio(s1: &str, s2: &str) -> f64 {
    if s1 == s2 {
        return 100.0;
    }
    let chars1: Vec<char> = s1.chars().collect();
    let chars2: Vec<char> = s2.chars().collect();
    let total = chars1.len() + chars2.len();
    if total == 0 {
        return 0.0;
    }
    let lcs = lcs_length(&chars1, &chars2);
    ((2.0 * lcs as f64) / total as f64 * 100.0).clamp(0.0, 100.0)
}

/// Partial ratio: finds best match ratio of shorter string within longer string
pub fn fuzz_partial_ratio(shorter: &str, longer: &str) -> f64 {
    let short_chars: Vec<char> = shorter.chars().collect();
    let long_chars: Vec<char> = longer.chars().collect();
    let short_len = short_chars.len();
    let long_len = long_chars.len();

    if short_len == 0 || long_len == 0 {
        return 0.0;
    }
    if short_len > long_len {
        return fuzz_partial_ratio(longer, shorter);
    }
    if shorter == longer {
        return 100.0;
    }

    let mut best_score = 0.0f64;
    let min_sub_len = 1.max(short_len.saturating_sub(4));
    let max_sub_len = long_len.min(short_len + 4);

    for sub_len in min_sub_len..=max_sub_len {
        if sub_len > long_len {
            continue;
        }
        for i in 0..=(long_len - sub_len) {
            let sub = &long_chars[i..i + sub_len];
            let total = short_len + sub_len;
            let lcs = lcs_length(&short_chars, sub);
            let score = (2.0 * lcs as f64 / total as f64) * 100.0;
            if score > best_score {
                best_score = score;
                if (best_score - 100.0).abs() < f64::EPSILON {
                    return 100.0;
                }
            }
        }
    }

    best_score.clamp(0.0, 100.0)
}

/// Token set ratio: splits strings into sets of tokens and measures overlap
pub fn fuzz_token_set_ratio(s1: &str, s2: &str) -> f64 {
    let tokens1: HashSet<&str> = s1.split_whitespace().collect();
    let tokens2: HashSet<&str> = s2.split_whitespace().collect();

    let intersection: Vec<&str> = tokens1.intersection(&tokens2).copied().collect();
    let mut sorted_inter = intersection.clone();
    sorted_inter.sort_unstable();
    let inter_str = sorted_inter.join(" ");

    let diff1: Vec<&str> = tokens1.difference(&tokens2).copied().collect();
    let diff2: Vec<&str> = tokens2.difference(&tokens1).copied().collect();

    let mut combined1 = sorted_inter.clone();
    combined1.extend(diff1);
    let s1_clean = combined1.join(" ");

    let mut combined2 = sorted_inter;
    combined2.extend(diff2);
    let s2_clean = combined2.join(" ");

    let score1 = fuzz_ratio(&inter_str, &s1_clean);
    let score2 = fuzz_ratio(&inter_str, &s2_clean);
    let score3 = fuzz_ratio(&s1_clean, &s2_clean);

    score1.max(score2).max(score3)
}

/// Determines tri-zone classification and recommended validation status:
/// - GREEN (score >= 90.0%): APPROVED
/// - YELLOW (70.0% <= score < 90.0%): NEEDS_REVIEW
/// - RED (score < 70.0%): REJECTED
pub fn determine_zone(score: f64) -> (&'static str, &'static str) {
    if score >= 90.0 {
        ("GREEN", "APPROVED")
    } else if score >= 70.0 {
        ("YELLOW", "NEEDS_REVIEW")
    } else {
        ("RED", "REJECTED")
    }
}

/// Calculates fuzzy similarity between target reviewer name and extracted OCR text.
/// Ports all robustness heuristics from `matcher.py` (cracked screens, blur, moire artifacts):
/// 1. Full text standard partial ratio and token set ratio
/// 2. Line-by-line inspection matching Play Store reviewer layout
/// 3. Space-collapsed matching for physical cracks cutting words (e.g. 'Tom my' -> 'Tommy')
/// 4. Optical character confusion normalization (0 <-> o, 1 <-> i/l, rn <-> m, vv <-> w)
/// 5. Single-character Levenshtein distance tolerance for short names (e.g. 'Tiara' vs 'Tara')
/// 6. Exact token match for multi-word names without conflicting reviewer name
/// 7. Prefix and nickname matching (e.g. 'DICKI' vs 'dickyyuhendra yhd')
/// 8. Multi-word sliding window across adjacent word tokens
pub fn calculate_similarity(target_name: &str, extracted_text: &str) -> (f64, &'static str, &'static str) {
    let unescaped_text = extracted_text.replace("\\n", "\n");
    let norm_target = normalize_text(target_name);
    let norm_extracted = normalize_text(&unescaped_text);

    if norm_target.is_empty() || norm_extracted.is_empty() {
        return (0.0, "RED", "REJECTED");
    }

    let target_words: Vec<&str> = norm_target.split_whitespace().collect();
    let target_no_space = norm_target.replace(' ', "");
    let lines: Vec<&str> = unescaped_text.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();

    let mut scores = Vec::with_capacity(32);

    // 1. Standard full-text matching
    if norm_extracted.len() >= norm_target.len() {
        scores.push(fuzz_partial_ratio(&norm_target, &norm_extracted));
    }
    scores.push(fuzz_token_set_ratio(&norm_target, &norm_extracted));

    // Minimum length threshold to prevent noise lines from triggering false positives
    let min_len = 3.max((target_no_space.len() as f64 * 0.6) as usize);

    let ui_stopwords: HashSet<&str> = [
        "bintang", "ulasan", "diedit", "edit", "anda", "bantu", "apakah", "ya", "tidak",
        "terima", "kasih", "pln", "mobile", "rating", "download", "ponsel", "desktop",
        "terakhir", "diupdate", "lihat", "semua", "developer", "balasan",
    ]
    .into_iter()
    .collect();

    // 2. Line-by-line review card matching
    for line in lines {
        let norm_line = normalize_text(line);
        let line_no_space = norm_line.replace(' ', "");

        if line_no_space.len() < min_len {
            continue;
        }

        scores.push(fuzz_ratio(&norm_target, &norm_line));
        if norm_line.len() >= norm_target.len() {
            scores.push(fuzz_partial_ratio(&norm_target, &norm_line));
        }

        // Space-collapsed matching for screen cracks splitting characters (e.g. 'Tom my')
        if line_no_space.contains(&target_no_space) {
            scores.push(100.0);
        } else if line_no_space.len() >= target_no_space.len() {
            scores.push(fuzz_partial_ratio(&target_no_space, &line_no_space));
        }

        // Optical character confusion normalization:
        // (0 <-> o, 1 <-> i, 5 <-> s, 8 <-> b, rn <-> m, vv <-> w)
        let sub_fn = |c: char| match c {
            '0' => 'o',
            '1' => 'i',
            '5' => 's',
            '8' => 'b',
            other => other,
        };

        let target_sub: String = target_no_space.chars().map(sub_fn).collect();
        let mut line_clean: String = line.to_lowercase().chars().filter(|c| c.is_alphanumeric()).map(sub_fn).collect();
        line_clean = line_clean.replace("rn", "m").replace("vv", "w");

        if line_clean.len() >= min_len {
            if line_clean.contains(&target_sub) {
                scores.push(95.0);
            } else if line_clean.len() >= target_sub.len() {
                scores.push(fuzz_partial_ratio(&target_sub, &line_clean));
            }
        }

        let line_words: Vec<&str> = norm_line.split_whitespace().filter(|w| w.len() >= 2).collect();

        // 3. Single-character Levenshtein tolerance for short names (4-6 chars)
        if (4..=6).contains(&target_no_space.len()) {
            for &w in &line_words {
                let w_len = w.len();
                let t_len = target_no_space.len();
                if w_len == t_len - 1 || w_len == t_len || w_len == t_len + 1 {
                    if levenshtein(&target_no_space, w) <= 1 {
                        scores.push(92.0);
                    }
                }
            }
        }

        // 4. Token subset match for multi-word names when no conflicting reviewer name is present
        if target_words.len() > 1 && !line_words.is_empty() {
            let matching_tokens: Vec<&str> = line_words
                .iter()
                .copied()
                .filter(|&w| {
                    target_words.iter().any(|&tw| {
                        w == tw || (w.len() >= 4 && tw.len() >= 4 && levenshtein(w, tw) <= 1)
                    })
                })
                .collect();

            let conflicting_tokens: Vec<&str> = line_words
                .iter()
                .copied()
                .filter(|&w| {
                    !target_words.iter().any(|&tw| {
                        w == tw || (w.len() >= 4 && tw.len() >= 4 && levenshtein(w, tw) <= 1)
                    })
                })
                .collect();

            let real_conflicts: Vec<&str> = conflicting_tokens
                .into_iter()
                .filter(|w| !ui_stopwords.contains(w))
                .collect();

            if !matching_tokens.is_empty() && real_conflicts.is_empty() {
                let max_tok_len = matching_tokens.iter().map(|w| w.len()).max().unwrap_or(0);
                if max_tok_len >= 4 {
                    scores.push(92.0);
                }
            }
        }

        // 5. Prefix and nickname matching (e.g. 'DICKI' vs 'dickyyuhendra yhd')
        if target_no_space.len() >= 4 {
            let mut t_norm_ending = target_no_space.clone();
            if t_norm_ending.ends_with('i') {
                t_norm_ending.pop();
                t_norm_ending.push('y');
            } else if t_norm_ending.ends_with('y') {
                t_norm_ending.pop();
                t_norm_ending.push('i');
            }

            for &w in &line_words {
                if w.starts_with(&target_no_space) || w.starts_with(&t_norm_ending) {
                    scores.push(92.0);
                } else if target_no_space.len() >= 5 && w.len() >= target_no_space.len() {
                    let prefix = &w[..target_no_space.len()];
                    if levenshtein(&target_no_space, prefix) <= 1 {
                        scores.push(92.0);
                    }
                }
            }
        }
    }

    // 6. Multi-word sliding window across adjacent word tokens
    let words: Vec<&str> = norm_extracted.split_whitespace().collect();
    if target_words.len() > 1 && words.len() >= target_words.len() {
        let k = target_words.len();
        for i in 0..=(words.len() - k) {
            let window = words[i..i + k].join(" ");
            scores.push(fuzz_ratio(&norm_target, &window));
        }
    }

    let max_score = scores.into_iter().fold(0.0f64, |acc, val| acc.max(val)).clamp(0.0, 100.0);
    let final_score = (max_score * 100.0).round() / 100.0;
    let (zone, status) = determine_zone(final_score);

    (final_score, zone, status)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_text() {
        assert_eq!(normalize_text("Budi Santoso! 😊 123"), "budi santoso 123");
        assert_eq!(normalize_text("   Budi   \n  Santoso  "), "budi santoso");
    }

    #[test]
    fn test_exact_match_score() {
        let (score, zone, status) = calculate_similarity("Budi Santoso", "Budi Santoso\n5 Bintang\nSangat Bagus");
        assert!(score >= 90.0);
        assert_eq!(zone, "GREEN");
        assert_eq!(status, "APPROVED");
    }

    #[test]
    fn test_screen_cracks_character_split() {
        // "Tom my" due to glass crack line splitting characters of "Tommy"
        let (score, zone, status) = calculate_similarity("Tommy", "Tom my\nUlasan Play Store");
        assert!(score >= 90.0);
        assert_eq!(zone, "GREEN");
        assert_eq!(status, "APPROVED");
    }

    #[test]
    fn test_optical_character_substitution() {
        // "8ud1" OCR confusion for "Budi"
        let (score, zone, _) = calculate_similarity("Budi", "8ud1\nUlasan");
        assert!(score >= 90.0);
        assert_eq!(zone, "GREEN");
    }

    #[test]
    fn test_short_name_single_char_tolerance() {
        // "Tiara" vs OCR missing one character "Tara"
        let (score, zone, _) = calculate_similarity("Tiara", "Tara\nAplikasi bagus");
        assert!(score >= 90.0);
        assert_eq!(zone, "GREEN");
    }

    #[test]
    fn test_nickname_prefix_match() {
        // "DICKI" vs full handle "dickyyuhendra"
        let (score, zone, _) = calculate_similarity("DICKI", "dickyyuhendra\nBagus sekali");
        assert!(score >= 90.0);
        assert_eq!(zone, "GREEN");
    }

    #[test]
    fn test_completely_different_name() {
        let (score, zone, status) = calculate_similarity("Agus Priyono", "Siti Aminah\nUlasan pelanggan");
        assert!(score < 70.0);
        assert_eq!(zone, "RED");
        assert_eq!(status, "REJECTED");
    }
}

