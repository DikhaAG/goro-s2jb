import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";
import { forRole } from "@/lib/routeAuthorization";

describe("Task 12.5: Layer 5 UI Navigation RBAC Filter & Zero Route Leakage Test Suite", () => {
  const getHrefs = (role: Role | null, pathname = "/") =>
    forRole(role)
      .sidebarItems(pathname)
      .map((item) => item.href);

  const isActive = (role: Role, itemHref: string, pathname: string) =>
    forRole(role)
      .sidebarItems(pathname)
      .find((item) => item.href === itemHref)?.active ?? false;

  describe("1. Canonical Route Alignment & Zero Legacy Alias in UI Navigation", () => {
    it("should ensure all sidebar items point strictly to canonical URLs and contain no legacy aliases", () => {
      const items = forRole(Role.SUPER_ADMIN).sidebarItems("/");
      const allHrefs = items.map((item) => item.href);

      expect(allHrefs).toEqual([
        "/",
        "/intake",
        "/reviews",
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

      for (const item of items) {
        expect(item.id).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.href.startsWith("/")).toBe(true);
      }
    });
  });

  describe("2. Role-Based Navigation Filtering (Zero Route Leakage)", () => {
    it("should return EMPTY navigation for unauthenticated visitors", () => {
      expect(forRole(null).sidebarItems("/")).toEqual([]);
      expect(forRole(undefined).sidebarItems("/")).toEqual([]);
    });

    it("should return exactly 2 items for Petugas Lapangan: ['/', '/intake']", () => {
      const hrefs = getHrefs(Role.PETUGAS_LAPANGAN);

      expect(hrefs).toEqual(["/", "/intake"]);
      expect(hrefs).not.toContain("/triage");
      expect(hrefs).not.toContain("/reports");
      expect(hrefs).not.toContain("/users");
      expect(hrefs).not.toContain("/migration");
      expect(hrefs).not.toContain("/migration/monitor");
      expect(hrefs).not.toContain("/system-processes");
      expect(hrefs).not.toContain("/audit-logs");
    });

    it("should return exactly 4 items for Pegawai Triase: ['/', '/reviews', '/migration', '/migration/monitor']", () => {
      const hrefs = getHrefs(Role.PEGAWAI);

      expect(hrefs).toEqual(["/", "/reviews", "/migration", "/migration/monitor"]);
      expect(hrefs).not.toContain("/intake");
      expect(hrefs).not.toContain("/reports");
      expect(hrefs).not.toContain("/users");
      expect(hrefs).not.toContain("/system-processes");
      expect(hrefs).not.toContain("/audit-logs");
    });

    it("should return exactly 2 items for Manager UID: ['/', '/reports']", () => {
      const hrefs = getHrefs(Role.MANAGER);

      expect(hrefs).toEqual(["/", "/reports"]);
      expect(hrefs).not.toContain("/intake");
      expect(hrefs).not.toContain("/triage");
      expect(hrefs).not.toContain("/users");
      expect(hrefs).not.toContain("/migration");
      expect(hrefs).not.toContain("/migration/monitor");
      expect(hrefs).not.toContain("/system-processes");
      expect(hrefs).not.toContain("/audit-logs");
    });

    it("should return all 9 items for Super Admin without omissions", () => {
      expect(getHrefs(Role.SUPER_ADMIN)).toEqual([
        "/",
        "/intake",
        "/reviews",
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
      expect(isActive(Role.SUPER_ADMIN, "/", "/")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/", "/intake")).toBe(false);
      expect(isActive(Role.SUPER_ADMIN, "/", "/triage")).toBe(false);
      expect(isActive(Role.SUPER_ADMIN, "/", "/reports")).toBe(false);
      expect(isActive(Role.SUPER_ADMIN, "/", "/users")).toBe(false);
    });

    it("should activate module items when pathname matches canonical route or sub-paths", () => {
      expect(isActive(Role.SUPER_ADMIN, "/intake", "/intake")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/intake", "/intake/step-2")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/reviews", "/reviews")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/reviews", "/reviews/detail/123")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/reports", "/reports")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/reports", "/reports/daily")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/users", "/users")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/users", "/users/create")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/migration", "/migration")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/audit-logs", "/audit-logs")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/system-processes", "/system-processes")).toBe(true);
    });

    it("should prevent prefix collision between /migration and /migration/monitor", () => {
      expect(isActive(Role.PEGAWAI, "/migration/monitor", "/migration/monitor")).toBe(true);
      expect(isActive(Role.PEGAWAI, "/migration", "/migration/monitor")).toBe(false);

      expect(isActive(Role.PEGAWAI, "/migration", "/migration")).toBe(true);
      expect(isActive(Role.PEGAWAI, "/migration/monitor", "/migration")).toBe(false);

      expect(isActive(Role.PEGAWAI, "/migration", "/migration/upload")).toBe(true);
      expect(isActive(Role.PEGAWAI, "/migration/monitor", "/migration/upload")).toBe(false);

      expect(isActive(Role.PEGAWAI, "/migration/monitor", "/migration/monitor/worker-1")).toBe(true);
      expect(isActive(Role.PEGAWAI, "/migration", "/migration/monitor/worker-1")).toBe(false);
    });

    it("should support backward-compatible rewrite paths for legacy aliases", () => {
      expect(isActive(Role.SUPER_ADMIN, "/reviews", "/operator/triage")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/reviews", "/triage")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/reports", "/manager/reports")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/users", "/admin/users")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/migration", "/admin/migration")).toBe(true);
      expect(isActive(Role.SUPER_ADMIN, "/system-processes", "/admin/system-processes")).toBe(true);
    });
  });
});
