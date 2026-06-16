/**
 * Signup Flow E2E Test
 *
 * Tests the invite-only signup process using a pre-seeded invite code.
 */

import { expect, test } from "@playwright/test";

import { E2E_INVITE_CODE, E2E_SIGNUP } from "./constants";

// This test needs an unauthenticated browser
test.use({ storageState: { cookies: [], origins: [] } });

test("new user can sign up with invite code", async ({ page }) => {
  await page.goto("/signup");

  // Fill the signup form
  await page.getByLabel("Invite Code").fill(E2E_INVITE_CODE.code);
  await page.getByLabel("Email").fill(E2E_SIGNUP.email);
  await page.getByLabel("Username").fill(E2E_SIGNUP.username);
  await page.getByLabel("Display Name").fill(E2E_SIGNUP.displayName);
  await page.getByLabel("Password").fill(E2E_SIGNUP.password);

  // Submit
  await page.getByRole("button", { name: "Create account" }).click();

  // Should redirect to dashboard
  await page.waitForURL("/home", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /at CDb/ })).toBeVisible();
});

test("signup fails with invalid invite code", async ({ page }) => {
  await page.goto("/signup");

  await page.getByLabel("Invite Code").fill("INVALIDCODE1");
  await page.getByLabel("Email").fill("invalid@e2e.test");
  await page.getByLabel("Username").fill("e2e_invalid");
  await page.getByLabel("Password").fill("InvalidPass123!");

  await page.getByRole("button", { name: "Create account" }).click();

  // Should show an error, not redirect
  await expect(page.getByText(/invalid|expired|error/i).first()).toBeVisible({ timeout: 5_000 });
  await expect(page).toHaveURL(/\/signup/);
});
