import { describe, it, expect } from "vitest";

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("WCAG 2.1 AA Color Contrast Verification", () => {
  const CANVAS = "#F9F9FF";
  const CARD_WHITE = "#FFFFFF";

  it("ensures carbon text #0F172A has AAA contrast on canvas and white cards", () => {
    const ratioCanvas = contrastRatio("#0F172A", CANVAS);
    const ratioCard = contrastRatio("#0F172A", CARD_WHITE);

    // WCAG AAA requires >= 7:1 for normal text
    expect(ratioCanvas).toBeGreaterThanOrEqual(7.0);
    expect(ratioCard).toBeGreaterThanOrEqual(7.0);
  });

  it("ensures secondary text #1E293B has AAA contrast on canvas and white cards", () => {
    const ratioCanvas = contrastRatio("#1E293B", CANVAS);
    const ratioCard = contrastRatio("#1E293B", CARD_WHITE);

    expect(ratioCanvas).toBeGreaterThanOrEqual(7.0);
    expect(ratioCard).toBeGreaterThanOrEqual(7.0);
  });

  it("ensures muted metadata #64748B satisfies WCAG AA (>= 4.5:1) on white card", () => {
    const ratioCard = contrastRatio("#64748B", CARD_WHITE);
    expect(ratioCard).toBeGreaterThanOrEqual(4.5);
  });

  it("ensures primary brand teal #006877 on pastel blue #E7EEFF satisfies WCAG AA", () => {
    const ratio = contrastRatio("#006877", "#E7EEFF");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("ensures emerald status text #15803D on pastel green #ECFDF5 satisfies WCAG AA", () => {
    const ratio = contrastRatio("#15803D", "#ECFDF5");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("ensures amber status text #B45309 on pastel amber #FFF7ED satisfies WCAG AA", () => {
    const ratio = contrastRatio("#B45309", "#FFF7ED");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("ensures danger status text #B91C1C on pastel red #FEF2F2 satisfies WCAG AA", () => {
    const ratio = contrastRatio("#B91C1C", "#FEF2F2");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
