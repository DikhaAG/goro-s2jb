"use client";

import React from "react";

interface OcrTextHighlighterProps {
  ocrText: string | null;
  targetName: string;
  className?: string;
}

export function OcrTextHighlighter({
  ocrText,
  targetName,
  className = "",
}: OcrTextHighlighterProps) {
  if (!ocrText || ocrText.trim().length === 0) {
    return (
      <span className="italic text-slate-500 text-xs">
        (Tidak ada teks terdeteksi dari OCR)
      </span>
    );
  }

  // Extract non-trivial target tokens (length >= 2)
  const targetTokens = targetName
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  if (targetTokens.length === 0) {
    return <span className={className}>{ocrText}</span>;
  }

  // Split OCR text into words while keeping delimiters
  const words = ocrText.split(/(\s+)/);

  return (
    <div className={`text-xs text-slate-300 leading-relaxed font-sans ${className}`}>
      {words.map((word, index) => {
        const cleanWord = word.toLowerCase().replace(/[^\w]/g, "");
        const isMatch = targetTokens.some(
          (token) => cleanWord.includes(token) || token.includes(cleanWord) && cleanWord.length >= 3
        );

        if (isMatch) {
          return (
            <mark
              key={index}
              className="bg-emerald-500/25 text-emerald-300 font-semibold px-1 py-0.5 rounded border border-emerald-500/40"
            >
              {word}
            </mark>
          );
        }

        return <React.Fragment key={index}>{word}</React.Fragment>;
      })}
    </div>
  );
}
