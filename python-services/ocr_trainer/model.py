#!/usr/bin/env python3
"""
Lightweight CRNN (Convolutional Recurrent Neural Network) for Mobile OCR.
Optimized for low-latency training and inference on CPU, Apple Silicon (MPS),
and NVIDIA CUDA.
"""

import os
import torch
import torch.nn as nn
from typing import Dict, Any

class CRNN(nn.Module):
    def __init__(self, img_height: int = 32, in_channels: int = 1, num_classes: int = 80, hidden_dim: int = 128):
        super(CRNN, self).__init__()
        self.img_height = img_height
        self.in_channels = in_channels
        self.num_classes = num_classes
        self.hidden_dim = hidden_dim

        # 1. CNN Feature Extractor
        self.cnn = nn.Sequential(
            nn.Conv2d(in_channels, 32, kernel_size=3, stride=1, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2), # (32, 16, W/2)

            nn.Conv2d(32, 64, kernel_size=3, stride=1, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2), # (64, 8, W/4)

            nn.Conv2d(64, 128, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=(2, 1), stride=(2, 1)), # (128, 4, W/4)

            nn.Conv2d(128, 128, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=(2, 1), stride=(2, 1)), # (128, 2, W/4)

            nn.Conv2d(128, 256, kernel_size=(2, 1), stride=1, padding=0),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True), # (256, 1, W/4)
        )

        # 2. Bidirectional LSTM Recurrent Layers
        self.rnn = nn.LSTM(
            input_size=256,
            hidden_size=hidden_dim,
            num_layers=2,
            bidirectional=True,
            batch_first=False
        )

        # 3. Transcription Layer
        self.fc = nn.Linear(hidden_dim * 2, num_classes)
        self.log_softmax = nn.LogSoftmax(dim=2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: (Batch, in_channels, Height=32, Width)
        conv = self.cnn(x)
        b, c, h, w = conv.size()
        assert h == 1, f"Expected height 1 after CNN, got {h}"

        # Squeeze height: (Batch, Channels, Width) -> Transpose to (Width, Batch, Channels)
        conv = conv.squeeze(2)
        conv = conv.permute(2, 0, 1) # Sequence length = Width

        # Recurrent feature extraction: (Width, Batch, hidden_dim * 2)
        recurrent, _ = self.rnn(conv)

        # Linear projection to class probabilities
        seq_len, batch_size, _ = recurrent.size()
        logits = self.fc(recurrent) # (Width, Batch, num_classes)

        output = self.log_softmax(logits)
        return output

    def save_checkpoint(self, filepath: str, metadata: Dict[str, Any] = None):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        checkpoint = {
            "state_dict": self.state_dict(),
            "img_height": self.img_height,
            "in_channels": self.in_channels,
            "num_classes": self.num_classes,
            "hidden_dim": self.hidden_dim,
            "metadata": metadata or {},
        }
        torch.save(checkpoint, filepath)

    @classmethod
    def load_from_checkpoint(cls, filepath: str, map_location: str = "cpu") -> "CRNN":
        checkpoint = torch.load(filepath, map_location=map_location, weights_only=False)
        model = cls(
            img_height=checkpoint["img_height"],
            in_channels=checkpoint["in_channels"],
            num_classes=checkpoint["num_classes"],
            hidden_dim=checkpoint["hidden_dim"]
        )
        model.load_state_dict(checkpoint["state_dict"])
        return model

