import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { Role } from "@prisma/client";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { requireServerAuth } from "@/lib/server-auth";
import FieldLayout from "@/app/(field)/layout";
import OperatorLayout from "@/app/(operator)/layout";
import ManagerLayout from "@/app/(manager)/layout";
import AdminLayout from "@/app/(admin)/layout";

// Mock next/navigation redirect
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Mock next/headers cookies
let mockCookieStore: Record<string, string> = {};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      mockCookieStore[name] ? { name, value: mockCookieStore[name] } : undefined,
  })),
}));

// Mock AppShell to keep unit isolation simple
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Task 12.3: Layer 2 Server Component Layout Guards Isolation Test Suite", () => {
  let fieldToken: string;
  let operatorToken: string;
  let managerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    fieldToken = await signSessionToken({
      id: "usr_field_layout",
      username: "petugas_rivai",
      name: "Ahmad Field",
      role: Role.PETUGAS_LAPANGAN,
      up3Id: "up3_plg",
      ulpId: "ulp_riv",
    });

    operatorToken = await signSessionToken({
      id: "usr_operator_layout",
      username: "pegawai_operator",
      name: "Budi Triage",
      role: Role.PEGAWAI,
      up3Id: "up3_plg",
      ulpId: null,
    });

    managerToken = await signSessionToken({
      id: "usr_manager_layout",
      username: "manager_s2jb",
      name: "Hendra Manager",
      role: Role.MANAGER,
      up3Id: null,
      ulpId: null,
    });

    adminToken = await signSessionToken({
      id: "usr_admin_layout",
      username: "superadmin",
      name: "Super Administrator",
      role: Role.SUPER_ADMIN,
      up3Id: null,
      ulpId: null,
    });
  });

  beforeEach(() => {
    mockCookieStore = {};
    mockRedirect.mockClear();
  });

  function setSessionToken(token?: string) {
    if (token) {
      mockCookieStore[SESSION_COOKIE_NAME] = token;
    } else {
      delete mockCookieStore[SESSION_COOKIE_NAME];
    }
  }

  describe("1. requireServerAuth Core Guard Logic", () => {
    it("should redirect to /login when no session cookie exists", async () => {
      setSessionToken(undefined);

      await expect(requireServerAuth()).rejects.toThrow("NEXT_REDIRECT:/login");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("should redirect to /unauthorized?required=<ROLE> when user role is not authorized", async () => {
      setSessionToken(fieldToken);

      await expect(
        requireServerAuth([Role.PEGAWAI, Role.SUPER_ADMIN])
      ).rejects.toThrow("NEXT_REDIRECT:/unauthorized?required=PEGAWAI");
      expect(mockRedirect).toHaveBeenCalledWith("/unauthorized?required=PEGAWAI");
    });

    it("should return SessionUser when user role is within allowedRoles", async () => {
      setSessionToken(fieldToken);

      const user = await requireServerAuth([Role.PETUGAS_LAPANGAN, Role.SUPER_ADMIN]);
      expect(user).toBeDefined();
      expect(user.role).toBe(Role.PETUGAS_LAPANGAN);
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe("2. Field Module Layout Guard (src/app/(field)/layout.tsx)", () => {
    const renderFieldLayout = () => FieldLayout({ children: "FieldContent" });

    it("should redirect unauthenticated guest to /login", async () => {
      setSessionToken(undefined);
      await expect(renderFieldLayout()).rejects.toThrow("NEXT_REDIRECT:/login");
    });

    it("should permit Petugas Lapangan and Super Admin", async () => {
      setSessionToken(fieldToken);
      const resField = await renderFieldLayout();
      expect(resField).toBeDefined();

      setSessionToken(adminToken);
      const resAdmin = await renderFieldLayout();
      expect(resAdmin).toBeDefined();
    });

    it("should reject Pegawai Triase and Manager with redirect to /unauthorized", async () => {
      setSessionToken(operatorToken);
      await expect(renderFieldLayout()).rejects.toThrow(
        "NEXT_REDIRECT:/unauthorized?required=PETUGAS_LAPANGAN"
      );

      setSessionToken(managerToken);
      await expect(renderFieldLayout()).rejects.toThrow(
        "NEXT_REDIRECT:/unauthorized?required=PETUGAS_LAPANGAN"
      );
    });
  });

  describe("3. Operator Module Layout Guard (src/app/(operator)/layout.tsx)", () => {
    const renderOperatorLayout = () => OperatorLayout({ children: "OperatorContent" });

    it("should redirect unauthenticated guest to /login", async () => {
      setSessionToken(undefined);
      await expect(renderOperatorLayout()).rejects.toThrow("NEXT_REDIRECT:/login");
    });

    it("should permit Pegawai Triase and Super Admin", async () => {
      setSessionToken(operatorToken);
      const resOperator = await renderOperatorLayout();
      expect(resOperator).toBeDefined();

      setSessionToken(adminToken);
      const resAdmin = await renderOperatorLayout();
      expect(resAdmin).toBeDefined();
    });

    it("should reject Petugas Lapangan and Manager with redirect to /unauthorized", async () => {
      setSessionToken(fieldToken);
      await expect(renderOperatorLayout()).rejects.toThrow(
        "NEXT_REDIRECT:/unauthorized?required=PEGAWAI"
      );

      setSessionToken(managerToken);
      await expect(renderOperatorLayout()).rejects.toThrow(
        "NEXT_REDIRECT:/unauthorized?required=PEGAWAI"
      );
    });
  });

  describe("4. Manager Module Layout Guard (src/app/(manager)/layout.tsx)", () => {
    const renderManagerLayout = () => ManagerLayout({ children: "ManagerContent" });

    it("should redirect unauthenticated guest to /login", async () => {
      setSessionToken(undefined);
      await expect(renderManagerLayout()).rejects.toThrow("NEXT_REDIRECT:/login");
    });

    it("should permit Manager and Super Admin", async () => {
      setSessionToken(managerToken);
      const resManager = await renderManagerLayout();
      expect(resManager).toBeDefined();

      setSessionToken(adminToken);
      const resAdmin = await renderManagerLayout();
      expect(resAdmin).toBeDefined();
    });

    it("should reject Petugas Lapangan and Pegawai with redirect to /unauthorized", async () => {
      setSessionToken(fieldToken);
      await expect(renderManagerLayout()).rejects.toThrow(
        "NEXT_REDIRECT:/unauthorized?required=MANAGER"
      );

      setSessionToken(operatorToken);
      await expect(renderManagerLayout()).rejects.toThrow(
        "NEXT_REDIRECT:/unauthorized?required=MANAGER"
      );
    });
  });

  describe("5. Admin Module Layout Guard (src/app/(admin)/layout.tsx)", () => {
    const renderAdminLayout = () => AdminLayout({ children: "AdminContent" });

    it("should redirect unauthenticated guest to /login", async () => {
      setSessionToken(undefined);
      await expect(renderAdminLayout()).rejects.toThrow("NEXT_REDIRECT:/login");
    });

    it("should permit strictly Super Admin", async () => {
      setSessionToken(adminToken);
      const resAdmin = await renderAdminLayout();
      expect(resAdmin).toBeDefined();
    });

    it("should reject Petugas Lapangan, Pegawai, and Manager with redirect to /unauthorized", async () => {
      setSessionToken(fieldToken);
      await expect(renderAdminLayout()).rejects.toThrow(
        "NEXT_REDIRECT:/unauthorized?required=SUPER_ADMIN"
      );

      setSessionToken(operatorToken);
      await expect(renderAdminLayout()).rejects.toThrow(
        "NEXT_REDIRECT:/unauthorized?required=SUPER_ADMIN"
      );

      setSessionToken(managerToken);
      await expect(renderAdminLayout()).rejects.toThrow(
        "NEXT_REDIRECT:/unauthorized?required=SUPER_ADMIN"
      );
    });
  });
});
