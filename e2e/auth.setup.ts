/**
 * Auth Setup — runs before all tests to create authenticated state.
 *
 * Logs in as the E2E admin user via the browser and saves the auth
 * cookies to a file that other tests reuse.
 */

import { expect, test as setup } from "@playwright/test";

import { E2E_ADMIN } from "./constants";

const ADMIN_AUTH_FILE = "e2e/.auth/admin.json";

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email or Username").fill(E2E_ADMIN.username);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Log in" }).click();

  // Wait for redirect to dashboard
  await page.waitForURL("/home", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /at CDb/ })).toBeVisible();

  // Save auth state for reuse
  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});
