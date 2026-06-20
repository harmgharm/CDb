/**
 * Auth Flow E2E Tests
 *
 * Tests authentication, protected routes, and navigation.
 */

import { expect, test } from "@playwright/test";

test.describe("authenticated user", () => {
  test("can see the dashboard", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: /at CDb/ })).toBeVisible();
  });

  test("sees sidebar navigation", async ({ page }) => {
    await page.goto("/home");

    await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Database", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users", exact: true })).toBeVisible();
  });

  test("admin sees admin nav item", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
  });

  test("can navigate to database page", async ({ page }) => {
    await page.goto("/home");
    await page.getByRole("link", { name: "Database", exact: true }).click();
    await page.waitForURL("/database");
    // Editorial masthead heading is "The collection" (Phase 7+), not "Database".
    await expect(page.getByRole("heading", { name: /collection/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("can navigate to users page", async ({ page }) => {
    await page.goto("/home");
    await page.getByRole("link", { name: "Users", exact: true }).click();
    await page.waitForURL("/users");
    // Editorial masthead heading is "The cast" (Phase 7+), not "Users".
    await expect(page.getByRole("heading", { name: /cast/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("unauthenticated user", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("is redirected to login from protected route", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login/);
  });

  test("can see the landing page", async ({ page }) => {
    await page.goto("/");
    // The landing hero leads with the "CDb" wordmark and the login/signup CTAs.
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  });

  test("landing page has login and signup links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  });
});
