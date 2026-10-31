import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";
import {
  NAV_ITEMS,
  filterNavItemsByRole,
  NavMenuItem,
  isNavItemActive,
} from "@/components/layout/GlobalSidebar";

describe("Task 12.5: Layer 5 UI Navigation RBAC Filter & Zero Route Leakage Test Suite", () => {
  const getHrefs = (items: NavMenuItem[]) => items.map((item) => item.href);

  describe("1. Canonical Route Alignment & Zero Legacy Alias in UI Navigation", () => {
    it("should ensure all NAV_ITEMS point strictly to canonical URLs and contain no legacy aliases", () => {
      const allHrefs = getHrefs(NAV_ITEMS);

      expect(allHrefs).toEqual([
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

      for (const href of allHrefs) {
        expect(href).not.toContain("/operator/");
        expect(href).not.toContain("/manager/");
        expect(href).not.toContain("/admin/");
      }
    });

    it("should verify that every menu item has a valid label and icon component", () => {
      for (const item of NAV_ITEMS) {
        expect(item.label).toBeTruthy();
        expect(item.href.startsWith("/")).toBe(true);
        expect(item.icon).toBeDefined();
        expect(Array.isArray(item.roles)).toBe(true);
        expect(item.roles.length).toBeGreaterThan(0);
      }
    });
  });

  describe("2. Role-Based Navigation Filtering (Zero Route Leakage)", () => {
    it("should return EMPTY navigation for GUEST (unauthenticated visitors)", () => {
      const guestItems = filterNavItemsByRole("GUEST");
      expect(guestItems).toHaveLength(0);
      expect(getHrefs(guestItems)).toEqual([]);
    });

    it("should return exactly 2 items for Petugas Lapangan: ['/', '/intake']", () => {
      const fieldItems = filterNavItemsByRole(Role.PETUGAS_LAPANGAN);
      const hrefs = getHrefs(fieldItems);

      expect(fieldItems).toHaveLength(2);
      expect(hrefs).toEqual(["/", "/intake"]);

      // Verify strict isolation from other modules
      expect(hrefs).not.toContain("/triage");
      expect(hrefs).not.toContain("/reports");
      expect(hrefs).not.toContain("/users");
      expect(hrefs).not.toContain("/migration");
      expect(hrefs).not.toContain("/migration/monitor");
      expect(hrefs).not.toContain("/system-processes");
      expect(hrefs).not.toContain("/audit-logs");
    });

    it("should return exactly 4 items for Pegawai Triase: ['/', '/triage', '/migration', '/migration/monitor']", () => {
      const operatorItems = filterNavItemsByRole(Role.PEGAWAI);
      const hrefs = getHrefs(operatorItems);

      expect(operatorItems).toHaveLength(4);
      expect(hrefs).toEqual(["/", "/triage", "/migration", "/migration/monitor"]);

      // Verify strict isolation
      expect(hrefs).not.toContain("/intake");
      expect(hrefs).not.toContain("/reports");
      expect(hrefs).not.toContain("/users");
      expect(hrefs).toContain("/migration");
      expect(hrefs).toContain("/migration/monitor");
      expect(hrefs).not.toContain("/system-processes");
      expect(hrefs).not.toContain("/audit-logs");
    });

    it("should return exactly 2 items for Manager UID: ['/', '/reports']", () => {
      const managerItems = filterNavItemsByRole(Role.MANAGER);
      const hrefs = getHrefs(managerItems);

      expect(managerItems).toHaveLength(2);
      expect(hrefs).toEqual(["/", "/reports"]);

      // Verify strict isolation
      expect(hrefs).not.toContain("/intake");
      expect(hrefs).not.toContain("/triage");
      expect(hrefs).not.toContain("/users");
      expect(hrefs).not.toContain("/migration");
      expect(hrefs).not.toContain("/migration/monitor");
      expect(hrefs).not.toContain("/system-processes");
      expect(hrefs).not.toContain("/audit-logs");
    });

    it("should return all 9 items for Super Admin without omissions", () => {
      const adminItems = filterNavItemsByRole(Role.SUPER_ADMIN);
      const hrefs = getHrefs(adminItems);

      expect(adminItems).toHaveLength(9);
      expect(hrefs).toEqual([
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
  });

  describe("3. Active Route Matching Logic Verification", () => {
    it("should activate root dashboard ONLY on exact match '/'", () => {
      expect(isNavItemActive("/", "/")).toBe(true);
      expect(isNavItemActive("/", "/intake")).toBe(false);
      expect(isNavItemActive("/", "/triage")).toBe(false);
      expect(isNavItemActive("/", "/reports")).toBe(false);
      expect(isNavItemActive("/", "/users")).toBe(false);
    });

    it("should activate module items when pathname matches canonical route or sub-paths", () => {
      expect(isNavItemActive("/intake", "/intake")).toBe(true);
      expect(isNavItemActive("/intake", "/intake/step-2")).toBe(true);

      expect(isNavItemActive("/triage", "/triage")).toBe(true);
      expect(isNavItemActive("/triage", "/triage/review/123")).toBe(true);

      expect(isNavItemActive("/reports", "/reports")).toBe(true);
      expect(isNavItemActive("/reports", "/reports/daily")).toBe(true);

      expect(isNavItemActive("/users", "/users")).toBe(true);
      expect(isNavItemActive("/users", "/users/create")).toBe(true);

      expect(isNavItemActive("/migration", "/migration")).toBe(true);
      expect(isNavItemActive("/audit-logs", "/audit-logs")).toBe(true);
      expect(isNavItemActive("/system-processes", "/system-processes")).toBe(true);
    });

    it("should prevent prefix collision between /migration and /migration/monitor", () => {
      // When on /migration/monitor, ONLY /migration/monitor should be active, NOT /migration
      expect(isNavItemActive("/migration/monitor", "/migration/monitor")).toBe(true);
      expect(isNavItemActive("/migration", "/migration/monitor")).toBe(false);

      // When on /migration, ONLY /migration should be active, NOT /migration/monitor
      expect(isNavItemActive("/migration", "/migration")).toBe(true);
      expect(isNavItemActive("/migration/monitor", "/migration")).toBe(false);

      // Sub-paths of /migration (that are not monitor) should keep /migration active
      expect(isNavItemActive("/migration", "/migration/upload")).toBe(true);
      expect(isNavItemActive("/migration/monitor", "/migration/upload")).toBe(false);

      // Sub-paths of /migration/monitor should keep /migration/monitor active
      expect(isNavItemActive("/migration/monitor", "/migration/monitor/worker-1")).toBe(true);
      expect(isNavItemActive("/migration", "/migration/monitor/worker-1")).toBe(false);
    });

    it("should support backward-compatible rewrite paths for legacy aliases", () => {
      expect(isNavItemActive("/triage", "/operator/triage")).toBe(true);
      expect(isNavItemActive("/reports", "/manager/reports")).toBe(true);
      expect(isNavItemActive("/users", "/admin/users")).toBe(true);
      expect(isNavItemActive("/migration", "/admin/migration")).toBe(true);
    });
  });
});
