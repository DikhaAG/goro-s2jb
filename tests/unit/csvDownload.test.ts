import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/client/csvDownload";

describe("toCsv", () => {
  it("quotes every cell and doubles embedded quotes", () => {
    expect(toCsv([["a", 'say "hi"', 1.5]])).toBe('"a","say ""hi""","1.5"');
  });

  it("keeps commas, line breaks, and # inside a single field", () => {
    expect(toCsv([["Budi #1, UP3", "baris\nkedua"]])).toBe('"Budi #1, UP3","baris\nkedua"');
  });

  it("writes null and undefined as empty fields and joins rows with newlines", () => {
    expect(toCsv([["x", null, undefined], ["y"]])).toBe('"x","",""\n"y"');
  });
});
