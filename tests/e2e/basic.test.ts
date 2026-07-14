import { test, expect } from "@playwright/test";

test.describe("Weatherly Basic Journeys", () => {
  test("should load home page and render local weather detection", async ({ page }) => {
    // Navigate to local deployment
    await page.goto("http://localhost:3000/");

    // Expect page title to match branding
    await expect(page).toHaveTitle(/Weatherly/);

    // Verify presence of title and auto geolocation text
    await expect(page.locator("h1")).toContainText("Local Weather Insight");
  });

  test("should navigate to City Dashboard and allow search", async ({ page }) => {
    await page.goto("http://localhost:3000/dashboard");

    // Expect search input to be visible
    const searchInput = page.locator("input[placeholder*='Search city']");
    await expect(searchInput).toBeVisible();

    // Type a search query
    await searchInput.fill("London");
    
    // Wait for geocoding options list to show up
    await page.waitForTimeout(1000); // Wait for debouncing
  });
});
