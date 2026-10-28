import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";
import { NAV_ITEMS, filterNavItemsByRole, NavMenuItem } from "@/components/layout/GlobalSidebar";

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
      expect(hrefs).not.toContain("/audit-logs");
    });

    it("should return exactly 3 items for Pegawai Triase: ['/', '/triage', '/migration']", () => {
      const operatorItems = filterNavItemsByRole(Role.PEGAWAI);
      const hrefs = getHrefs(operatorItems);

      expect(operatorItems).toHaveLength(3);
      expect(hrefs).toEqual(["/", "/triage", "/migration"]);

      // Verify strict isolation
      expect(hrefs).not.toContain("/intake");
      expect(hrefs).not.toContain("/reports");
      expect(hrefs).not.toContain("/users");
      expect(hrefs).toContain("/migration");
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
      expect(hrefs).not.toContain("/audit-logs");
    });

    it("should return all 7 items for Super Admin without omissions", () => {
      const adminItems = filterNavItemsByRole(Role.SUPER_ADMIN);
      const hrefs = getHrefs(adminItems);

      expect(adminItems).toHaveLength(7);
      expect(hrefs).toEqual([
        "/",
        "/intake",
        "/triage",
        "/reports",
        "/users",
        "/migration",
        "/audit-logs",
      ]);
    });
  });

  describe("3. Active Route Matching Logic Verification", () => {
    function isItemActive(itemHref: string, currentPathname: string): boolean {
      if (itemHref === "/") {
        return currentPathname === "/";
      }
      return (
        currentPathname.startsWith(itemHref) ||
        (itemHref === "/triage" && currentPathname.startsWith("/operator/triage")) ||
        (itemHref === "/reports" && currentPathname.startsWith("/manager/reports")) ||
        (itemHref === "/users" && currentPathname.startsWith("/admin/users"))
      );
    }

    it("should activate root dashboard ONLY on exact match '/'", () => {
      expect(isItemActive("/", "/")).toBe(true);
      expect(isItemActive("/", "/intake")).toBe(false);
      expect(isItemActive("/", "/triage")).toBe(false);
      expect(isItemActive("/", "/reports")).toBe(false);
      expect(isItemActive("/", "/users")).toBe(false);
    });

    it("should activate module items when pathname matches canonical route or sub-paths", () => {
      expect(isItemActive("/intake", "/intake")).toBe(true);
      expect(isItemActive("/intake", "/intake/step-2")).toBe(true);

      expect(isItemActive("/triage", "/triage")).toBe(true);
      expect(isItemActive("/triage", "/triage/review/123")).toBe(true);

      expect(isItemActive("/reports", "/reports")).toBe(true);
      expect(isItemActive("/reports", "/reports/daily")).toBe(true);

      expect(isItemActive("/users", "/users")).toBe(true);
      expect(isItemActive("/users", "/users/create")).toBe(true);

      expect(isItemActive("/migration", "/migration")).toBe(true);
      expect(isItemActive("/audit-logs", "/audit-logs")).toBe(true);
    });

    it("should support backward-compatible rewrite paths for legacy aliases", () => {
      expect(isItemActive("/triage", "/operator/triage")).toBe(true);
      expect(isItemActive("/reports", "/manager/reports")).toBe(true);
      expect(isItemActive("/users", "/admin/users")).toBe(true);
    });
  });
});
