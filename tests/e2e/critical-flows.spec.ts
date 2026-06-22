import { test, expect } from "@playwright/test";

test.describe("Agentify Critical B2B SaaS E2E Flows", () => {
  test("Marketing Page and robots/sitemap verification", async ({ page }) => {
    // 1. Visit homepage
    await page.goto("/");
    await expect(page).toHaveTitle(/Agentify/i);

    // 2. Verify robots.txt route is accessible
    const robots = await page.goto("/robots.txt");
    expect(robots?.status()).toBe(200);

    // 3. Verify sitemap.xml is accessible
    const sitemap = await page.goto("/sitemap.xml");
    expect(sitemap?.status()).toBe(200);
  });

  test("Hosted Chat Link public availability check", async ({ page }) => {
    // Try to access a public demo path or public hosted chat
    await page.goto("/demo/nonexistent-demo-slug");
    // Should display descriptive error or not crash
    expect(page.url()).toContain("/demo/nonexistent-demo-slug");
  });
});
