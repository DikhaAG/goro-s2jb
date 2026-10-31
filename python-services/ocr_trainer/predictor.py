#!/usr/bin/env python3
"""
CRNN Text Predictor / Inference Module for PLN Mobile Review OCR.
Supports single-image inference with trained PyTorch CRNN checkpoints and domain lexicons.
"""

import os
import sys
import json
import argparse
from typing import Optional, Union
from PIL import Image
import numpy as np
import torch

# Ensure ocr_trainer directory is on sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

from lexicon_builder import LexiconBuilder
from model import CRNN
from evaluator import ctc_greedy_decode

def select_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")

_CACHED_MODELS = {}

def get_or_load_model(checkpoint_path: str, device: Optional[torch.device] = None) -> Optional[tuple]:
    """Caches loaded CRNN models and lexicons in memory for fast repeated inference."""
    global _CACHED_MODELS
    if not checkpoint_path or not os.path.exists(checkpoint_path):
        return None

    if device is None:
        device = select_device()

    cache_key = f"{checkpoint_path}:{str(device)}"
    if cache_key in _CACHED_MODELS:
        return _CACHED_MODELS[cache_key]

    try:
        # Load model checkpoint
        model = CRNN.load_from_checkpoint(checkpoint_path, map_location=str(device))
        model.to(device)
        model.eval()

        # Load lexicon from sibling file lexicon.json if present
        model_dir = os.path.dirname(checkpoint_path)
        lexicon_path = os.path.join(model_dir, "lexicon.json")
        lexicon = LexiconBuilder()
        if os.path.exists(lexicon_path):
            lexicon.load_lexicon(lexicon_path)

        _CACHED_MODELS[cache_key] = (model, lexicon, device)
        return (model, lexicon, device)
    except Exception as e:
        sys.stderr.write(f"Error loading model from {checkpoint_path}: {e}\n")
        return None

def preprocess_for_crnn(img: Image.Image, target_height: int = 32, max_width: int = 384) -> torch.Tensor:
    """Preprocesses a PIL Image into a normalized tensor (1, 1, 32, W)."""
    img = img.convert("L")
    w, h = img.size
    aspect_ratio = w / max(h, 1)
    new_w = max(32, int(target_height * aspect_ratio))
    new_w = min(new_w, max_width)
    new_w = ((new_w + 3) // 4) * 4 # Divisible by 4

    resized = img.resize((new_w, target_height), Image.Resampling.BILINEAR)
    img_np = np.array(resized, dtype=np.float32)
    img_tensor = torch.from_numpy(img_np)
    img_tensor = (img_tensor / 255.0 - 0.5) / 0.5
    img_tensor = img_tensor.unsqueeze(0).unsqueeze(0) # (1, 1, 32, W)
    return img_tensor

def predict_crnn(
    image_input: Union[str, Image.Image],
    checkpoint_path: str,
    device: Optional[torch.device] = None
) -> str:
    """Runs CRNN inference on an image path or PIL Image."""
    loaded = get_or_load_model(checkpoint_path, device)
    if not loaded:
        return ""

    model, lexicon, dev = loaded

    try:
        if isinstance(image_input, str):
            if not os.path.exists(image_input):
                return ""
            img = Image.open(image_input)
        else:
            img = image_input

        tensor = preprocess_for_crnn(img).to(dev)

        with torch.no_grad():
            output = model(tensor) # Shape: (Time, Batch=1, NumClasses)
            decoded_list = ctc_greedy_decode(output, lexicon)
            text = decoded_list[0] if decoded_list else ""
            return text.strip()
    except Exception as e:
        sys.stderr.write(f"Inference error: {e}\n")
        return ""

def main():
    parser = argparse.ArgumentParser(description="CRNN OCR Inference")
    parser.add_argument("--image", required=True, help="Path to evidence image")
    parser.add_argument("--model", required=True, help="Path to model checkpoint .pt")
    args = parser.parse_args()

    pred = predict_crnn(args.image, args.model)
    print(json.dumps({"predicted_text": pred}))

if __name__ == "__main__":
    main()
