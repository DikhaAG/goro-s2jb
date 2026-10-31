#!/usr/bin/env python3
"""
Unit Test Suite for Python OCR Trainer Modules (CRNN, Lexicon, Dataset, Evaluator).
"""

import unittest
import torch
import tempfile
import os

from lexicon_builder import LexiconBuilder
from model import CRNN
from dataset import OcrDataset, ocr_collate_fn
from evaluator import compute_cer, compute_wer, ctc_greedy_decode
from predictor import predict_crnn
from PIL import Image

class TestOcrTrainerModules(unittest.TestCase):
    def setUp(self):
        self.lexicon = LexiconBuilder()

    def test_lexicon_encode_decode(self):
        text = "PLN Mobile Ahmad Rizky"
        encoded = self.lexicon.encode(text)
        decoded = self.lexicon.decode(encoded)
        self.assertEqual(text, decoded)
        self.assertEqual(self.lexicon.char_to_idx["<blank>"], 0)

    def test_lexicon_save_load(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "vocab.json")
            self.lexicon.save_vocab(path)
            loaded = LexiconBuilder.load_vocab(path)
            self.assertEqual(self.lexicon.num_classes, loaded.num_classes)

    def test_crnn_forward_pass(self):
        model = CRNN(num_classes=self.lexicon.num_classes)
        # Synthetic batch: (Batch=2, Channel=1, Height=32, Width=128)
        dummy_input = torch.randn(2, 1, 32, 128)
        output = model(dummy_input)

        # Output shape should be (Time, Batch=2, num_classes)
        # Width 128 downsampled by 4 = 32 time steps
        self.assertEqual(output.size(1), 2) # Batch
        self.assertEqual(output.size(2), self.lexicon.num_classes)
        self.assertGreater(output.size(0), 10) # Time steps

    def test_crnn_checkpoint_save_load(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            model = CRNN(num_classes=self.lexicon.num_classes)
            path = os.path.join(tmpdir, "model.pt")
            model.save_checkpoint(path, metadata={"cer": 2.5})

            loaded = CRNN.load_from_checkpoint(path)
            self.assertEqual(loaded.num_classes, model.num_classes)

    def test_dataset_and_collate(self):
        samples = [
            {"image_path": "non_existent1.png", "ground_truth_text": "Ahmad"},
            {"image_path": "non_existent2.png", "ground_truth_text": "Budi Santoso"},
        ]
        dataset = OcrDataset(samples, self.lexicon, augment=False)
        self.assertEqual(len(dataset), 2)

        batch = [dataset[0], dataset[1]]
        padded_images, flat_targets, target_lengths, texts = ocr_collate_fn(batch)

        self.assertEqual(padded_images.size(0), 2)
        self.assertEqual(padded_images.size(1), 1)
        self.assertEqual(padded_images.size(2), 32)
        self.assertEqual(len(texts), 2)
        self.assertEqual(target_lengths.size(0), 2)

    def test_metrics_cer_wer(self):
        predictions = ["Ahmad Rizky", "PLN Mobil"]
        ground_truths = ["Ahmad Rizky", "PLN Mobile"]

        cer = compute_cer(predictions, ground_truths)
        wer = compute_wer(predictions, ground_truths)

        # Exactly 1 char error ('e' missing) in 21 chars total
        self.assertAlmostEqual(cer, 4.76, delta=0.5)
        # 1 word error in 4 words total
        self.assertAlmostEqual(wer, 25.0, delta=0.5)

    def test_ctc_greedy_decode(self):
        # Create synthetic log_probs where index 1 ("a" or first char) is max
        char1 = self.lexicon.charset[0]
        char1_idx = self.lexicon.char_to_idx[char1]

        # Time=3, Batch=1, NumClasses
        log_probs = torch.zeros(3, 1, self.lexicon.num_classes)
        # Sequence: char1, char1 (should collapse), blank (0)
        log_probs[0, 0, char1_idx] = 10.0
        log_probs[1, 0, char1_idx] = 10.0
        log_probs[2, 0, 0] = 10.0 # blank

        decoded = ctc_greedy_decode(log_probs, self.lexicon)
        self.assertEqual(len(decoded), 1)
        self.assertEqual(decoded[0], char1)

    def test_predictor_crnn(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            model = CRNN(num_classes=self.lexicon.num_classes)
            ckpt_path = os.path.join(tmpdir, "model.pt")
            model.save_checkpoint(ckpt_path)

            lex_path = os.path.join(tmpdir, "lexicon.json")
            self.lexicon.save_lexicon(lex_path)

            dummy_img = Image.new("L", (100, 32), color=255)
            pred = predict_crnn(dummy_img, ckpt_path, device=torch.device("cpu"))
            self.assertIsInstance(pred, str)

if __name__ == "__main__":
    unittest.main()

