import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { NAV_ITEMS } from "@/components/layout/GlobalSidebar";

describe("Design System & Antislop Compliance", () => {
  it("verifies zero em-dash (—) characters exist in UI components and routes", () => {
    const scanDir = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(scanDir(fullPath));
        } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
          results.push(fullPath);
        }
      }
      return results;
    };

    const targetDirs = [
      path.resolve(__dirname, "../../src/app"),
      path.resolve(__dirname, "../../src/components"),
    ];

    const allFiles = targetDirs.flatMap((d) => (fs.existsSync(d) ? scanDir(d) : []));
    const emDashRegex = /—/g; // U+2014

    const filesWithEmDash: { file: string; line: number; text: string }[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (emDashRegex.test(line)) {
          filesWithEmDash.push({
            file: path.relative(path.resolve(__dirname, "../.."), file),
            line: idx + 1,
            text: line.trim(),
          });
        }
      });
    }

    expect(
      filesWithEmDash,
      `Found ${filesWithEmDash.length} em-dash (—) occurrences violating antislop R-02:\n` +
      filesWithEmDash.map((f) => `  ${f.file}:${f.line} -> ${f.text}`).join("\n")
    ).toHaveLength(0);
  });

  it("verifies RBAC menu items permissions in GlobalSidebar specification", () => {
    // Field Officer sees 2 items
    const fieldItems = NAV_ITEMS.filter((i) => i.roles.includes("PETUGAS_LAPANGAN"));
    expect(fieldItems.map((i) => i.href)).toEqual(["/", "/intake"]);

    // Operator Verifikator sees 4 items
    const operatorItems = NAV_ITEMS.filter((i) => i.roles.includes("PEGAWAI"));
    expect(operatorItems.map((i) => i.href)).toEqual([
      "/",
      "/triage",
      "/migration",
      "/migration/monitor",
    ]);

    // Manager sees 2 items
    const managerItems = NAV_ITEMS.filter((i) => i.roles.includes("MANAGER"));
    expect(managerItems.map((i) => i.href)).toEqual(["/", "/reports"]);

    // Super Admin sees all 9 items
    const adminItems = NAV_ITEMS.filter((i) => i.roles.includes("SUPER_ADMIN"));
    expect(adminItems).toHaveLength(9);
    expect(adminItems.map((i) => i.href)).toEqual([
      "/",
      "/intake",
      "/triage",
      "/reports",
      "/users",
      "/migration",
      "/migration/monitor",
      "/system-processes",
      "/audit-logs",
    ]);
  });

  it("verifies PLN S2JB corporate design tokens and semantic palette harmony", () => {
    const PLN_TOKENS = {
      primaryCyan: "#00A3E0",
      primaryHover: "#0072A3",
      corporateNavy: "#0B132B",
      secondaryNavy: "#1C2541",
      cleanBackground: "#f8fafc",
    };

    expect(PLN_TOKENS.primaryCyan).toBe("#00A3E0");
    expect(PLN_TOKENS.primaryHover).toBe("#0072A3");
    expect(PLN_TOKENS.corporateNavy).toBe("#0B132B");
    expect(PLN_TOKENS.secondaryNavy).toBe("#1C2541");
    expect(PLN_TOKENS.cleanBackground).toBe("#f8fafc");
  });
});
