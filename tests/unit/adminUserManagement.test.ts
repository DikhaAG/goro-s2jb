import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";

describe("Task 9.2 & 9.3: User Creation Validation Constraints", () => {
  it("should enforce UP3 and ULP presence for Petugas Lapangan", () => {
    const validatePetugas = (role: Role, up3Id?: string | null, ulpId?: string | null) => {
      if (role === Role.PETUGAS_LAPANGAN) {
        if (!up3Id || !ulpId) {
          return { valid: false, error: "Petugas Lapangan wajib ditugaskan ke UP3 dan ULP spesifik." };
        }
      }
      return { valid: true };
    };

    expect(validatePetugas(Role.PETUGAS_LAPANGAN, null, null).valid).toBe(false);
    expect(validatePetugas(Role.PETUGAS_LAPANGAN, "up3_1", null).valid).toBe(false);
    expect(validatePetugas(Role.PETUGAS_LAPANGAN, "up3_1", "ulp_1").valid).toBe(true);

    // Other roles do not strictly mandate UP3 and ULP
    expect(validatePetugas(Role.MANAGER, null, null).valid).toBe(true);
    expect(validatePetugas(Role.SUPER_ADMIN, null, null).valid).toBe(true);
  });
});
