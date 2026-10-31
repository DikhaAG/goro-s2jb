#!/usr/bin/env python3
"""
Dataset, Augmentation, and Collate Functions for CRNN OCR Training.
"""

import os
from typing import List, Dict, Any, Tuple
from PIL import Image, ImageOps, ImageEnhance
import numpy as np
import torch
from torch.utils.data import Dataset

from lexicon_builder import LexiconBuilder

class OcrDataset(Dataset):
    def __init__(
        self,
        samples: List[Dict[str, Any]],
        lexicon: LexiconBuilder,
        target_height: int = 32,
        max_width: int = 384,
        augment: bool = False
    ):
        self.samples = samples
        self.lexicon = lexicon
        self.target_height = target_height
        self.max_width = max_width
        self.augment = augment

    def __len__(self) -> int:
        return len(self.samples)

    def _preprocess_image(self, img: Image.Image) -> Image.Image:
        # Convert to Grayscale
        img = img.convert("L")

        if self.augment:
            # Contrast jitter
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.0 + (torch.rand(1).item() - 0.5) * 0.4)

            # Auto-invert dark backgrounds if background is predominantly black
            stat = ImageOps.grayscale(img)
            hist = stat.histogram()
            if sum(hist[:128]) > sum(hist[128:]):
                img = ImageOps.invert(img)

        # Calculate proportional width
        w, h = img.size
        aspect_ratio = w / max(h, 1)
        new_w = max(32, int(self.target_height * aspect_ratio))
        new_w = min(new_w, self.max_width)

        # Ensure width is divisible by 4 (due to 2 max-pool layers with stride 2)
        new_w = ((new_w + 3) // 4) * 4

        img = img.resize((new_w, self.target_height), Image.Resampling.BILINEAR)
        return img

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, List[int], str]:
        sample = self.samples[idx]
        image_path = sample["image_path"]
        ground_truth = sample.get("ground_truth_text") or sample.get("reviewer_name") or ""

        # Load image or generate synthetic fallback if path not on disk
        if os.path.exists(image_path):
            try:
                img = Image.open(image_path)
            except Exception:
                img = Image.new("L", (128, 32), color=255)
        else:
            img = Image.new("L", (128, 32), color=255)

        processed = self._preprocess_image(img)

        # Convert to float tensor and normalize to [-1, 1]
        img_np = np.array(processed, dtype=np.float32)
        img_tensor = torch.from_numpy(img_np)
        img_tensor = (img_tensor / 255.0 - 0.5) / 0.5
        img_tensor = img_tensor.unsqueeze(0) # Shape: (1, Height=32, Width)

        encoded_label = self.lexicon.encode(ground_truth)
        # Fallback if label was empty
        if not encoded_label:
            encoded_label = [self.lexicon.char_to_idx.get(" ", 1)]

        return img_tensor, encoded_label, ground_truth

def ocr_collate_fn(batch: List[Tuple[torch.Tensor, List[int], str]]):
    """
    Pads variable-width images and flattens labels for CTC Loss.
    """
    images, labels, texts = zip(*batch)

    # Find maximum width in batch (divisible by 4)
    max_w = max(img.size(2) for img in images)
    max_w = ((max_w + 3) // 4) * 4

    batch_size = len(images)
    padded_images = torch.zeros(batch_size, 1, 32, max_w)

    for i, img in enumerate(images):
        w = img.size(2)
        padded_images[i, :, :, :w] = img

    # Flatten labels for PyTorch CTCLoss
    target_lengths = torch.tensor([len(l) for l in labels], dtype=torch.long)
    flat_targets = torch.tensor([idx for l in labels for idx in l], dtype=torch.long)

    return padded_images, flat_targets, target_lengths, list(texts)
