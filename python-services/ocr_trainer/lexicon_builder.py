#!/usr/bin/env python3
"""
Domain Lexicon & Character Set Builder for PLN Mobile OCR Training.
Manages character mapping (vocab) for CTC Loss, domain keyword dictionary,
and fuzzy lexicon rescoring.
"""

import string
import json
import os
from typing import List, Set, Dict, Any

# Standard alphanumeric character set + essential punctuation for review cards
DEFAULT_CHARSET = (
    string.ascii_letters +
    string.digits +
    " .,-_'\"@()/*+!?&#"
)

# Domain-specific keywords for PLN Mobile reviews
DOMAIN_VOCABULARY = [
    "PLN", "Mobile", "PLN Mobile", "UID", "S2JB", "UP3", "ULP",
    "Rivai", "Palembang", "Jambi", "Muara", "Bungo", "Lahat",
    "Bintang", "Ulasan", "Rating", "Pelanggan", "Respon", "Cepat",
    "Bagus", "Mantap", "Lancar", "Token", "Listrik", "Meteran",
    "Pasang", "Baru", "Tambah", "Daya", "Pengaduan", "Petugas",
    "Aplikasi", "Sangat", "Membantu", "Terima", "Kasih", "Layanan"
]

class LexiconBuilder:
    def __init__(self, charset: str = DEFAULT_CHARSET):
        # Index 0 is reserved for CTC Blank token
        self.blank_char = "<blank>"
        self.charset = list(dict.fromkeys(charset)) # deduplicate preserving order
        self.char_to_idx = {char: idx + 1 for idx, char in enumerate(self.charset)}
        self.idx_to_char = {idx + 1: char for idx, char in enumerate(self.charset)}
        self.char_to_idx[self.blank_char] = 0
        self.idx_to_char[0] = self.blank_char
        self.domain_words: Set[str] = set(w.lower() for w in DOMAIN_VOCABULARY)

    @property
    def num_classes(self) -> int:
        return len(self.char_to_idx)

    def encode(self, text: str) -> List[int]:
        """Encodes string into integer sequence, mapping unknown chars to space or ignoring."""
        indices = []
        for c in text:
            if c in self.char_to_idx:
                indices.append(self.char_to_idx[c])
            elif c.lower() in self.char_to_idx:
                indices.append(self.char_to_idx[c.lower()])
            else:
                # Map unknown to space if available
                if " " in self.char_to_idx:
                    indices.append(self.char_to_idx[" "])
        return indices

    def decode(self, indices: List[int]) -> str:
        """Decodes integer sequence back to string, omitting CTC blanks."""
        chars = []
        for idx in indices:
            if idx == 0:
                continue
            if idx in self.idx_to_char:
                chars.append(self.idx_to_char[idx])
        return "".join(chars)

    def add_texts_to_vocab(self, texts: List[str]):
        """Expands domain vocabulary with verified reviewer names and terms."""
        for text in texts:
            words = text.split()
            for w in words:
                cleaned = w.strip(".,-_'\"()").lower()
                if cleaned:
                    self.domain_words.add(cleaned)

    def save_vocab(self, filepath: str):
        data = {
            "charset": "".join(self.charset),
            "num_classes": self.num_classes,
            "domain_words": sorted(list(self.domain_words)),
        }
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    save_lexicon = save_vocab

    @classmethod
    def load_vocab(cls, filepath: str) -> "LexiconBuilder":
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        builder = cls(charset=data.get("charset", DEFAULT_CHARSET))
        builder.domain_words = set(data.get("domain_words", []))
        return builder

    load_lexicon = load_vocab

