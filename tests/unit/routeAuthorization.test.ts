import { describe, it, expect, vi } from "vitest";
import { Role } from "@prisma/client";
import {
  authorizeProxy,
  forRole,
  rolesForRouteGroup,
} from "@/lib/routeAuthorization";

describe("Otorisasi Rute (src/lib/routeAuthorization.ts)", () => {
  const userFor = (role: Role) => ({ id: `u-${role}`, role });

  describe("authorizeProxy", () => {
    it("bypasses static assets and /unauthorized without resolving Sesi Pengguna", async () => {
      const resolveUser = vi.fn(async () => userFor(Role.SUPER_ADMIN));

      expect(await authorizeProxy("/_next/static/chunk.js", resolveUser)).toEqual({
        kind: "bypass",
      });
      expect(await authorizeProxy("/favicon.ico", resolveUser)).toEqual({
        kind: "bypass",
      });
      expect(await authorizeProxy("/images/logo.png", resolveUser)).toEqual({
        kind: "bypass",
      });
      expect(await authorizeProxy("/unauthorized", resolveUser)).toEqual({
        kind: "allow",
        user: null,
      });

      expect(resolveUser).not.toHaveBeenCalled();
    });

    it("does not treat dotted dynamic paths as static bypasses", async () => {
      const resolveUser = vi.fn(async () => userFor(Role.PETUGAS_LAPANGAN));
      const decision = await authorizeProxy("/users/jane.doe", resolveUser);

      expect(resolveUser).toHaveBeenCalledTimes(1);
      expect(decision).toEqual({
        kind: "redirect",
        to: "/unauthorized?required=SUPER_ADMIN",
      });
    });

    it("handles /login for guests vs authenticated users with optional ?redirect=", async () => {
      expect(await authorizeProxy("/login", () => null)).toEqual({
        kind: "allow",
        user: null,
      });

      expect(
        await authorizeProxy("/login", () => userFor(Role.PEGAWAI))
      ).toEqual({
        kind: "redirect",
        to: "/reviews",
      });

      expect(
        await authorizeProxy("/login", () => userFor(Role.PEGAWAI), "?redirect=%2Fmigration%2Fmonitor")
      ).toEqual({
        kind: "redirect",
        to: "/migration/monitor",
      });

      expect(
        await authorizeProxy("/login", () => userFor(Role.PETUGAS_LAPANGAN), "?redirect=https://evil.com")
      ).toEqual({
        kind: "redirect",
        to: "/intake",
      });
    });

    it("enforces default-deny: blocks /system-processes for non-admin roles and distinguishes unknown 404 from forbidden 403", async () => {
      for (const role of [Role.PETUGAS_LAPANGAN, Role.PEGAWAI, Role.MANAGER]) {
        expect(await authorizeProxy("/system-processes", () => userFor(role))).toEqual({
          kind: "redirect",
          to: "/unauthorized?required=SUPER_ADMIN",
        });
      }

      expect(
        await authorizeProxy("/system-processes", () => userFor(Role.SUPER_ADMIN))
      ).toEqual({
        kind: "allow",
        user: userFor(Role.SUPER_ADMIN),
      });

      expect(await authorizeProxy("/does-not-exist", () => null)).toEqual({
        kind: "redirect",
        to: "/login",
      });

      expect(await authorizeProxy("/does-not-exist", () => userFor(Role.SUPER_ADMIN))).toEqual({
        kind: "not-found",
        user: userFor(Role.SUPER_ADMIN),
      });

      expect(await authorizeProxy("/triage-extra", () => userFor(Role.PEGAWAI))).toEqual({
        kind: "not-found",
        user: userFor(Role.PEGAWAI),
      });
    });

    it("rewrites all legacy aliases and sub-paths cleanly while preserving query strings", async () => {
      const operator = userFor(Role.PEGAWAI);
      const admin = userFor(Role.SUPER_ADMIN);
      const manager = userFor(Role.MANAGER);

      expect(await authorizeProxy("/triage", () => operator)).toEqual({
        kind: "allow",
        user: operator,
        rewriteTo: "/reviews",
      });
      expect(await authorizeProxy("/triage/review/123", () => operator, "?tab=ocr")).toEqual({
        kind: "allow",
        user: operator,
        rewriteTo: "/reviews/review/123?tab=ocr",
      });
      expect(await authorizeProxy("/operator/triage", () => operator)).toEqual({
        kind: "allow",
        user: operator,
        rewriteTo: "/reviews",
      });
      expect(await authorizeProxy("/manager/reports", () => manager)).toEqual({
        kind: "allow",
        user: manager,
        rewriteTo: "/reports",
      });
      expect(await authorizeProxy("/admin/users", () => admin)).toEqual({
        kind: "allow",
        user: admin,
        rewriteTo: "/users",
      });
      expect(await authorizeProxy("/admin/migration/monitor", () => operator)).toEqual({
        kind: "allow",
        user: operator,
        rewriteTo: "/migration/monitor",
      });
      expect(await authorizeProxy("/admin/audit-logs", () => admin)).toEqual({
        kind: "allow",
        user: admin,
        rewriteTo: "/audit-logs",
      });
      expect(await authorizeProxy("/admin/system-processes", () => admin)).toEqual({
        kind: "allow",
        user: admin,
        rewriteTo: "/system-processes",
      });
      expect(
        await authorizeProxy("/admin/system-processes", () => operator)
      ).toEqual({
        kind: "redirect",
        to: "/unauthorized?required=SUPER_ADMIN",
      });
    });

    it("preserves requested path and query in ?redirect= for unauthenticated visitors", async () => {
      expect(await authorizeProxy("/", () => null)).toEqual({
        kind: "redirect",
        to: "/login",
      });
      expect(await authorizeProxy("/triage", () => null, "?page=2")).toEqual({
        kind: "redirect",
        to: "/login?redirect=%2Ftriage%3Fpage%3D2",
      });
    });
  });

  describe("rolesForRouteGroup", () => {
    it("derives allowed roles for every route group from the single policy table", () => {
      expect(rolesForRouteGroup("field")).toEqual([Role.PETUGAS_LAPANGAN, Role.SUPER_ADMIN]);
      expect(rolesForRouteGroup("operator")).toEqual([Role.PEGAWAI, Role.SUPER_ADMIN]);
      expect(rolesForRouteGroup("manager")).toEqual([Role.MANAGER, Role.SUPER_ADMIN]);
      expect(rolesForRouteGroup("admin")).toEqual([Role.SUPER_ADMIN]);
    });
  });

  describe("forRole", () => {
    it("enforces default-deny on canVisit for unknown, malformed, and forbidden routes", () => {
      expect(forRole(null).canVisit("/")).toBe(false);
      expect(forRole(null).canVisit("/login")).toBe(true);
      expect(forRole(null).canVisit("/unauthorized")).toBe(true);

      expect(forRole(Role.PETUGAS_LAPANGAN).canVisit("/intake")).toBe(true);
      expect(forRole(Role.PETUGAS_LAPANGAN).canVisit("/system-processes")).toBe(false);
      expect(forRole(Role.SUPER_ADMIN).canVisit("/system-processes")).toBe(true);
      expect(forRole(Role.SUPER_ADMIN).canVisit("/unknown-route")).toBe(false);
      expect(forRole(Role.SUPER_ADMIN).canVisit("/users/../secret")).toBe(false);
    });

    it("resolves safe post-login landing and rejects open redirects or forbidden targets", () => {
      expect(forRole(Role.PETUGAS_LAPANGAN).resolveLanding()).toBe("/intake");
      expect(forRole(Role.PEGAWAI).resolveLanding()).toBe("/reviews");
      expect(forRole(Role.MANAGER).resolveLanding()).toBe("/reports");
      expect(forRole(Role.SUPER_ADMIN).resolveLanding()).toBe("/users");
      expect(forRole(null).resolveLanding("/intake")).toBe("/login");

      expect(forRole(Role.PEGAWAI).resolveLanding("/triage/review/9?tab=ocr#top")).toBe(
        "/reviews/review/9?tab=ocr#top"
      );
      expect(forRole(Role.PETUGAS_LAPANGAN).resolveLanding("/users")).toBe("/intake");
      expect(forRole(Role.SUPER_ADMIN).resolveLanding("https://evil.com")).toBe("/users");
      expect(forRole(Role.SUPER_ADMIN).resolveLanding("//evil.com")).toBe("/users");
      expect(forRole(Role.SUPER_ADMIN).resolveLanding("/\\evil.com")).toBe("/users");
      expect(forRole(Role.SUPER_ADMIN).resolveLanding("javascript:alert(1)")).toBe("/users");
      expect(forRole(Role.SUPER_ADMIN).resolveLanding("/login")).toBe("/users");
      expect(forRole(Role.SUPER_ADMIN).resolveLanding("/unauthorized")).toBe("/users");
      expect(forRole(Role.SUPER_ADMIN).resolveLanding("/unknown")).toBe("/users");
    });

    it("computes role-filtered sidebar items and collision-free active states", () => {
      expect(forRole(null).sidebarItems("/")).toEqual([]);

      expect(forRole(Role.PETUGAS_LAPANGAN).sidebarItems("/intake").map((i) => i.href)).toEqual([
        "/",
        "/intake",
      ]);

      const operatorItems = forRole(Role.PEGAWAI).sidebarItems("/admin/migration/monitor");
      expect(operatorItems.map((i) => i.href)).toEqual([
        "/",
        "/reviews",
        "/migration",
        "/migration/monitor",
      ]);
      expect(operatorItems.find((i) => i.href === "/migration")?.active).toBe(false);
      expect(operatorItems.find((i) => i.href === "/migration/monitor")?.active).toBe(true);

      const triageItems = forRole(Role.PEGAWAI).sidebarItems("/triage/123");
      expect(triageItems.find((i) => i.href === "/reviews")?.active).toBe(true);
      expect(triageItems.find((i) => i.href === "/")?.active).toBe(false);

      expect(forRole(Role.MANAGER).sidebarItems("/reports").map((i) => i.href)).toEqual([
        "/",
        "/reports",
      ]);

      expect(forRole(Role.SUPER_ADMIN).sidebarItems("/system-processes").map((i) => i.href)).toEqual([
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
});
