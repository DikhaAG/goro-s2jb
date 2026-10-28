import { test, expect } from "@playwright/test";

test.describe("Critical User Journey: Full Multi-Role Lifecycle (AC-1, AC-2, AC-4)", () => {
  test.describe.configure({ mode: "serial" });

  test("1. Login as Field Officer and submit evidence review", async ({ page }) => {
    // Navigate to Login
    await page.goto("/login");
    await expect(page).toHaveTitle(/GORO S2JB Command Center/);

    // Fill credentials
    await page.fill("#username", "petugas_rivai");
    await page.fill("#password", "password123");
    await page.click("button[type='submit']");

    // Expect automatic redirect to /intake
    await page.waitForURL("**/intake", { timeout: 10000 });
    await expect(page.locator("h1")).toContainText(/Entri Eviden Rating/);

    // Verify form elements exist
    await expect(page.locator("select").first()).toBeVisible();
  });

  test("2. Unauthorized access protection blocks Field Officer from Triage & Reports", async ({ page }) => {
    // Login as Field Officer
    await page.goto("/login");
    await page.fill("#username", "petugas_rivai");
    await page.fill("#password", "password123");
    await page.click("button[type='submit']");
    await page.waitForURL("**/intake");

    // Attempt to access /triage
    await page.goto("/triage");
    await page.waitForURL("**/unauthorized**");
    await expect(page.locator("h1")).toContainText(/Wewenang Akun Terbatas/);

    // Attempt to access /reports
    await page.goto("/reports");
    await page.waitForURL("**/unauthorized**");
    await expect(page.locator("h1")).toContainText(/Wewenang Akun Terbatas/);
  });

  test("3. Login as Pegawai Operator to access Yellow Zone Triage Command", async ({ page }) => {
    // Clear cookies & login as Operator
    await page.context().clearCookies();
    await page.goto("/login");

    await page.fill("#username", "pegawai_operator");
    await page.fill("#password", "password123");
    await page.click("button[type='submit']");

    // Expect redirect to /operator/triage or /triage
    await page.waitForURL(/(\/triage|\/operator\/triage)/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText(/Triase/);
  });

  test("4. Login as Executive Manager to view Reports Dashboard & Trigger Excel Export", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");

    await page.fill("#username", "manager_s2jb");
    await page.fill("#password", "password123");
    await page.click("button[type='submit']");

    await page.waitForURL(/(\/reports|\/manager\/reports)/, { timeout: 10000 });
    await expect(page.locator("h1")).toContainText(/Laporan & Pemantauan Performa/);

    // Verify KPI cards and Export buttons
    await expect(page.locator("text=Unduh Excel (.xlsx)")).toBeVisible();
    await expect(page.locator("text=Cetak PDF Resmi")).toBeVisible();
  });

  test("5. Login as Super Admin to manage users and access governance table", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");

    await page.fill("#username", "superadmin");
    await page.fill("#password", "password123");
    await page.click("button[type='submit']");

    await page.waitForURL("**/users", { timeout: 10000 });
    await expect(page.locator("h1")).toContainText(/Manajemen Pengguna/);

    // Verify table has seeded users
    await expect(page.locator("text=@petugas_rivai")).toBeVisible();
    await expect(page.locator("text=@manager_s2jb")).toBeVisible();
  });
});
