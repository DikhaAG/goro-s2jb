"""
Bridge module exposing CRNN deep learning predictor from ocr_trainer.
Allows local and relative module resolution for IDE static analyzers and runtime runners.
"""

import os
import sys

# Ensure sibling ocr_trainer directory is in sys.path
_parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_trainer_dir = os.path.join(_parent_dir, "ocr_trainer")
for _p in (_parent_dir, _trainer_dir):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from ocr_trainer.predictor import (
    predict_crnn,
    get_or_load_model,
    preprocess_for_crnn,
    select_device,
)

__all__ = [
    "predict_crnn",
    "get_or_load_model",
    "preprocess_for_crnn",
    "select_device",
]

