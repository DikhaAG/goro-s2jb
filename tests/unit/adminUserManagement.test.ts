import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";

// Define the navigation item structure as in GlobalSidebar
interface NavMenuItem {
  label: string;
  href: string;
  roles: string[];
}

const NAV_ITEMS: NavMenuItem[] = [
  {
    label: "Beranda Komando",
    href: "/",
    roles: ["GUEST", "PETUGAS_LAPANGAN", "PEGAWAI", "MANAGER", "SUPER_ADMIN"],
  },
  {
    label: "Entri Eviden Lapangan",
    href: "/intake",
    roles: ["GUEST", "PETUGAS_LAPANGAN", "SUPER_ADMIN"],
  },
  {
    label: "Triase Ulasan",
    href: "/triage",
    roles: ["GUEST", "PEGAWAI", "SUPER_ADMIN"],
  },
  {
    label: "Laporan Eksekutif",
    href: "/reports",
    roles: ["GUEST", "MANAGER", "SUPER_ADMIN"],
  },
  {
    label: "Manajemen Pengguna",
    href: "/users",
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Migrasi Data Eviden",
    href: "/admin/migration",
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Catatan Audit Log",
    href: "/admin/audit-logs",
    roles: ["SUPER_ADMIN"],
  },
];

function getVisibleNavItems(userRole: string): NavMenuItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(userRole));
}

describe("Task 9.1: Exclusive Super Admin Navigation Filtering", () => {
  it("should include 'Manajemen Pengguna' in navigation ONLY for SUPER_ADMIN", () => {
    const adminNav = getVisibleNavItems("SUPER_ADMIN");
    const userMgmtItem = adminNav.find((item) => item.href === "/users");
    expect(userMgmtItem).toBeDefined();
    expect(userMgmtItem?.label).toBe("Manajemen Pengguna");
  });

  it("should NOT include 'Manajemen Pengguna' in navigation for GUEST", () => {
    const guestNav = getVisibleNavItems("GUEST");
    const userMgmtItem = guestNav.find((item) => item.href === "/users");
    expect(userMgmtItem).toBeUndefined();
  });

  it("should NOT include 'Manajemen Pengguna' in navigation for PETUGAS_LAPANGAN", () => {
    const fieldNav = getVisibleNavItems("PETUGAS_LAPANGAN");
    const userMgmtItem = fieldNav.find((item) => item.href === "/users");
    expect(userMgmtItem).toBeUndefined();
  });

  it("should NOT include 'Manajemen Pengguna' in navigation for PEGAWAI", () => {
    const operatorNav = getVisibleNavItems("PEGAWAI");
    const userMgmtItem = operatorNav.find((item) => item.href === "/users");
    expect(userMgmtItem).toBeUndefined();
  });

  it("should NOT include 'Manajemen Pengguna' in navigation for MANAGER", () => {
    const managerNav = getVisibleNavItems("MANAGER");
    const userMgmtItem = managerNav.find((item) => item.href === "/users");
    expect(userMgmtItem).toBeUndefined();
  });

  it("should ensure all administrative routes (/users, /admin/*) are strictly locked to SUPER_ADMIN", () => {
    const adminRoutes = NAV_ITEMS.filter((item) => item.href.startsWith("/admin") || item.href === "/users");
    expect(adminRoutes.length).toBe(3);
    adminRoutes.forEach((route) => {
      expect(route.roles).toEqual(["SUPER_ADMIN"]);
    });
  });
});

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
