import { test, expect, type Page } from "@playwright/test";

// The login page caches auth.getSession = null; these submit right away, inside that cache's staleTime.
async function signInImmediately(page: Page, username: string) {
  await page.fill("#username", username);
  await page.fill("#password", "password123");
  await page.click("button[type='submit']");
}

const sidebar = (page: Page) => page.getByRole("complementary");

test.describe("Sesi Pengguna survives a fast sign-in and sign-out", () => {
  test("a manager who signs in right away sees their session and the reports", async ({ page }) => {
    await page.goto("/login");
    await signInImmediately(page, "manager_s2jb");
    await page.waitForURL(/\/reports/);

    await expect(sidebar(page)).toContainText("Manager UID");
    await expect(sidebar(page)).not.toContainText("Belum Masuk Sesi");
    await expect(page.getByRole("textbox", { name: /^Cari data di/ })).toBeVisible();
  });

  test("signing out and straight back in as another user shows the new user", async ({ page }) => {
    await page.goto("/login");
    await signInImmediately(page, "manager_s2jb");
    await page.waitForURL(/\/reports/);
    await expect(sidebar(page)).toContainText("Manager UID");

    await page.getByRole("button", { name: "Keluar dari Sesi" }).click();
    await page.waitForURL(/\/login/);
    await signInImmediately(page, "petugas_rivai");
    await page.waitForURL(/\/intake/);

    await expect(sidebar(page)).toContainText("Petugas Lapangan");
    await expect(sidebar(page)).not.toContainText("Manager UID");
  });
});
