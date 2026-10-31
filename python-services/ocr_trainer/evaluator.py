#!/usr/bin/env python3
"""
Objective Benchmarking & Evaluation (CER & WER) for Trained OCR Models.
"""

from typing import List, Dict, Any, Tuple
import torch
from rapidfuzz.distance import Levenshtein

from lexicon_builder import LexiconBuilder

def ctc_greedy_decode(log_probs: torch.Tensor, lexicon: LexiconBuilder) -> List[str]:
    """
    Greedy best-path CTC decoding:
    Input log_probs shape: (Time, Batch, NumClasses)
    Returns: List of decoded prediction strings.
    """
    # Argmax over class dimension
    preds = torch.argmax(log_probs, dim=2) # (Time, Batch)
    preds = preds.transpose(0, 1) # (Batch, Time)

    decoded_strings = []
    for b_idx in range(preds.size(0)):
        seq = preds[b_idx].tolist()
        collapsed = []
        prev = None
        for idx in seq:
            if idx != prev:
                if idx != 0: # 0 is CTC Blank
                    collapsed.append(idx)
                prev = idx
        text = lexicon.decode(collapsed)
        decoded_strings.append(text)

    return decoded_strings

def compute_cer(predictions: List[str], ground_truths: List[str]) -> float:
    """
    Character Error Rate (CER):
    (Substitutions + Deletions + Insertions) / Total Reference Characters * 100%
    """
    total_dist = 0
    total_chars = 0

    for pred, gt in zip(predictions, ground_truths):
        gt = gt.strip()
        pred = pred.strip()
        dist = Levenshtein.distance(gt, pred)
        total_dist += dist
        total_chars += max(len(gt), 1)

    return (total_dist / max(total_chars, 1)) * 100.0

def compute_wer(predictions: List[str], ground_truths: List[str]) -> float:
    """
    Word Error Rate (WER):
    (Substitutions + Deletions + Insertions) / Total Reference Words * 100%
    """
    total_dist = 0
    total_words = 0

    for pred, gt in zip(predictions, ground_truths):
        gt_words = gt.strip().split()
        pred_words = pred.strip().split()

        dist = Levenshtein.distance(gt_words, pred_words)
        total_dist += dist
        total_words += max(len(gt_words), 1)

    return (total_dist / max(total_words, 1)) * 100.0

def evaluate_model(
    model: torch.nn.Module,
    dataloader: torch.utils.data.DataLoader,
    lexicon: LexiconBuilder,
    device: torch.device
) -> Dict[str, Any]:
    """
    Evaluates model across a validation or benchmark DataLoader.
    """
    model.eval()
    all_preds = []
    all_gts = []

    with torch.no_grad():
        for images, _, _, texts in dataloader:
            images = images.to(device)
            # Output: (Time, Batch, NumClasses)
            log_probs = model(images)
            preds = ctc_greedy_decode(log_probs, lexicon)

            all_preds.extend(preds)
            all_gts.extend(texts)

    cer = compute_cer(all_preds, all_gts)
    wer = compute_wer(all_preds, all_gts)

    # Calculate exact match accuracy
    exact_matches = sum(1 for p, g in zip(all_preds, all_gts) if p.strip().lower() == g.strip().lower())
    accuracy = (exact_matches / max(len(all_gts), 1)) * 100.0

    return {
        "cer": round(cer, 2),
        "wer": round(wer, 2),
        "accuracy": round(accuracy, 2),
        "total_evaluated": len(all_gts),
        "sample_comparisons": [
            {"ground_truth": g, "predicted": p}
            for g, p in zip(all_gts[:5], all_preds[:5])
        ]
    }

