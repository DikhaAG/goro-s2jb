#!/usr/bin/env python3
"""
Main Deep Learning OCR Trainer for PLN Mobile Review Evidences.
Supports adaptive device acceleration (CUDA, Apple Silicon MPS, CPU),
CTC Loss optimization, dynamic loss streaming, and benchmark evaluation.
"""

import sys
import os
import json
import time
import argparse
from typing import List, Dict, Any

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

from lexicon_builder import LexiconBuilder
from model import CRNN
from dataset import OcrDataset, ocr_collate_fn
from evaluator import evaluate_model

def select_device() -> torch.device:
    """Adaptive cross-platform device selector."""
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif torch.backends.mps.is_available():
        return torch.device("mps")
    else:
        return torch.device("cpu")

def emit_event(event_type: str, data: Dict[str, Any]):
    """Emits structured JSON line to stdout for BullMQ / Node.js consumption."""
    payload = {"type": event_type, **data, "timestamp": time.time()}
    print(json.dumps(payload, ensure_ascii=False), flush=True)

def train(
    dataset_path: str,
    output_dir: str,
    epochs: int = 5,
    batch_size: int = 8,
    lr: float = 0.001,
    benchmark_path: str = None
) -> Dict[str, Any]:
    start_time = time.time()
    device = select_device()

    # 1. Load Training Dataset
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset JSON file not found: {dataset_path}")

    with open(dataset_path, "r", encoding="utf-8") as f:
        samples = json.load(f)

    if not samples:
        raise ValueError("Training dataset JSON contains 0 samples.")

    # 2. Build Vocabulary & Lexicon
    all_texts = [s.get("ground_truth_text") or s.get("reviewer_name") or "" for s in samples]
    lexicon = LexiconBuilder()
    lexicon.add_texts_to_vocab(all_texts)

    os.makedirs(output_dir, exist_ok=True)
    vocab_path = os.path.join(output_dir, "vocab.json")
    lexicon.save_vocab(vocab_path)

    emit_event("init", {
        "device": str(device),
        "total_samples": len(samples),
        "num_classes": lexicon.num_classes,
        "epochs": epochs,
        "batch_size": batch_size,
    })

    # 3. Create Dataset & DataLoader
    train_dataset = OcrDataset(samples, lexicon, augment=True)
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        collate_fn=ocr_collate_fn,
        drop_last=False
    )

    # 4. Initialize CRNN Model & Loss
    model = CRNN(num_classes=lexicon.num_classes).to(device)
    ctc_loss = nn.CTCLoss(blank=0, zero_infinity=True)
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)

    # 5. Training Loop
    model.train()
    for epoch in range(1, epochs + 1):
        epoch_loss = 0.0
        batches_count = 0

        for images, targets, target_lengths, _ in train_loader:
            images = images.to(device)
            targets = targets.to(device)
            target_lengths = target_lengths.to(device)

            optimizer.zero_grad()

            # Output shape: (Time, Batch, NumClasses)
            log_probs = model(images)
            time_steps, cur_batch_size, _ = log_probs.size()

            input_lengths = torch.full(
                size=(cur_batch_size,),
                fill_value=time_steps,
                dtype=torch.long,
                device=device
            )

            loss = ctc_loss(log_probs, targets, input_lengths, target_lengths)

            # Prevent gradient explosion
            if not torch.isnan(loss) and not torch.isinf(loss):
                loss.backward()
                nn.utils.clip_grad_norm_(model.parameters(), max_norm=5.0)
                optimizer.step()
                epoch_loss += loss.item()
                batches_count += 1

        avg_loss = round(epoch_loss / max(batches_count, 1), 4)

        emit_event("progress", {
            "epoch": epoch,
            "total_epochs": epochs,
            "loss": avg_loss,
            "lr": lr,
            "elapsed_seconds": round(time.time() - start_time, 2)
        })

    # 6. Evaluation on Benchmark (or internal validation set)
    eval_samples = samples
    if benchmark_path and os.path.exists(benchmark_path):
        with open(benchmark_path, "r", encoding="utf-8") as f:
            eval_samples = json.load(f)

    eval_dataset = OcrDataset(eval_samples, lexicon, augment=False)
    eval_loader = DataLoader(eval_dataset, batch_size=batch_size, shuffle=False, collate_fn=ocr_collate_fn)
    metrics = evaluate_model(model, eval_loader, lexicon, device)

    emit_event("metrics", metrics)

    # 7. Save Checkpoint
    checkpoint_path = os.path.join(output_dir, "weights_latest.pt")
    model.save_checkpoint(checkpoint_path, metadata={
        "trained_samples": len(samples),
        "epochs": epochs,
        "metrics": metrics,
        "device": str(device),
        "duration_seconds": round(time.time() - start_time, 2)
    })

    duration_seconds = round(time.time() - start_time, 2)

    result = {
        "success": True,
        "artifact_path": checkpoint_path,
        "vocab_path": vocab_path,
        "metrics": metrics,
        "duration_seconds": duration_seconds,
        "device": str(device)
    }

    emit_event("completed", result)
    return result

def main():
    parser = argparse.ArgumentParser(description="Deep Learning OCR Trainer for PLN Mobile")
    parser.add_argument("--dataset-json", required=True, help="Path to training samples JSON")
    parser.add_argument("--output-dir", required=True, help="Directory to save model weights and vocab")
    parser.add_argument("--epochs", type=int, default=5, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=8, help="Batch size")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--benchmark-json", default=None, help="Optional benchmark set for evaluation")

    args = parser.parse_args()

    try:
        train(
            dataset_path=args.dataset_json,
            output_dir=args.output_dir,
            epochs=args.epochs,
            batch_size=args.batch_size,
            lr=args.lr,
            benchmark_path=args.benchmark_json
        )
    except Exception as e:
        emit_event("error", {"error": str(e)})
        sys.exit(1)

if __name__ == "__main__":
    main()

