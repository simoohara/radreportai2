import { test, expect } from '@playwright/test';

test.describe('RadReport AI App', () => {
  test('should load the homepage and display the title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Rad Report AI/);
  });

  test('should have a login link', async ({ page }) => {
    await page.goto('/');

    // Ensure the login button is visible on the landing page
    const loginButton = page.locator('button', { hasText: /Continuer avec Google/i }).first();
    await expect(loginButton).toBeVisible();
  });
});
