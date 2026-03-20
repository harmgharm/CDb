/**
 * Auth Flow E2E Tests
 *
 * Tests authentication, protected routes, and navigation.
 */

import { expect, test } from "@playwright/test";

test.describe("authenticated user", () => {
  test("can see the dashboard", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("sees sidebar navigation", async ({ page }) => {
    await page.goto("/home");

    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Database" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
  });

  test("admin sees admin nav item", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  });

  test("can navigate to database page", async ({ page }) => {
    await page.goto("/home");
    await page.getByRole("link", { name: "Database" }).click();
    await page.waitForURL("/database");
    await expect(page.getByRole("heading", { name: "Database" })).toBeVisible({ timeout: 10_000 });
  });

  test("can navigate to users page", async ({ page }) => {
    await page.goto("/home");
    await page.getByRole("link", { name: "Users" }).click();
    await page.waitForURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({ timeout: 10_000 });
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
    await expect(page.getByRole("heading", { name: "CinemaDatabase" })).toBeVisible();
  });

  test("landing page has login and signup links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Log In" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign Up" })).toBeVisible();
  });
});
