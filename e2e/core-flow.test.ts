/**
 * Core Flow E2E Test
 *
 * Tests the critical path: import movie → create session → submit rating → verify.
 * Uses real TMDB API for the import step.
 */

import { expect, test } from "@playwright/test";

test.describe.serial("core flow", () => {
  test("import a movie from TMDB", async ({ page }) => {
    await page.goto("/database");

    // Wait for page to hydrate (data loaded and interactive)
    await expect(page.getByText("No media found")).toBeVisible({ timeout: 10_000 });

    // Open import dialog
    await page.getByRole("button", { name: "Add Media" }).first().click();
    await expect(page.getByText("Search TMDB and MyAnimeList")).toBeVisible({ timeout: 10_000 });

    // Search for a well-known movie
    await page.getByPlaceholder("Search for a title...").fill("The Shawshank Redemption");

    // Wait for TMDB results (real API call) — find the Shawshank result heading
    const shawshankResult = page
      .locator("[role='button'], [role='link']")
      .filter({
        hasText: "The Shawshank Redemption",
      })
      .first();
    await expect(shawshankResult).toBeVisible({ timeout: 10_000 });

    // Click the Import button within the Shawshank result row
    const importButton = shawshankResult.getByRole("button", { name: "Import" });
    await importButton.click();

    // Verify import succeeded — button should change to "In Database" or "Added"
    await expect(shawshankResult.getByRole("button", { name: /In Database|Added/ })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("create a watch session with rating", async ({ page }) => {
    await page.goto("/database");

    // Find the imported movie and navigate to its detail page
    await page.getByPlaceholder("Search titles...").fill("Shawshank");
    await expect(page.getByRole("link", { name: /Shawshank/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await page
      .getByRole("link", { name: /Shawshank/i })
      .first()
      .click();

    // Verify we're on the media detail page
    await expect(page.getByRole("heading", { name: /Shawshank/i })).toBeVisible({
      timeout: 10_000,
    });

    // Open create session dialog
    await page.getByRole("button", { name: "Log Session" }).click();
    await expect(page.getByText("Log Watch Session")).toBeVisible({ timeout: 10_000 });

    // Fill the date
    const today = new Date().toISOString().split("T")[0] ?? "";
    await page.getByLabel("Date Watched").fill(today);

    // Scope interactions to the dialog
    const dialog = page.getByRole("dialog", { name: "Log Watch Session" });

    // Check the admin user as attendee (if not already checked)
    const adminCheckbox = dialog.getByRole("checkbox", { name: /E2E Admin/i }).first();
    if (!(await adminCheckbox.isChecked())) {
      await adminCheckbox.check();
    }

    // Fill rating
    await dialog.getByPlaceholder("Rating").first().fill("9");

    // Submit the form
    await dialog.getByRole("button", { name: /Create Session/i }).click();

    // Wait for dialog to close (success) or error toast
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });
  });

  test("verify movie appears in database", async ({ page }) => {
    await page.goto("/database");

    // Wait for page to load. The database page is the editorial "The collection"
    // masthead (Phase 7+), which renders the title across two responsive <h1>s.
    await expect(page.getByRole("heading", { name: /collection/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Search for the movie
    await page.getByPlaceholder("Search titles...").fill("Shawshank");

    // Should find it
    await expect(page.getByText(/Shawshank/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("verify dashboard shows stats", async ({ page }) => {
    await page.goto("/home");

    // Dashboard should show stat cards with values
    await expect(page.getByRole("heading", { name: /at CDb/ })).toBeVisible();

    // At minimum, the stats section should be present
    const statsSection = page.locator("[class*='grid']").filter({ hasText: /Movies|Sessions/i });
    await expect(statsSection.first()).toBeVisible({ timeout: 5_000 });
  });
});
