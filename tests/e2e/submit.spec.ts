import { test, expect } from '@playwright/test';
import { mockLogin } from './helpers/login';

test('submit a TikTok URL creates task', async ({ page }) => {
  await mockLogin(page);
  await page.goto('/submit');
  await page.getByLabel('TikTok URL').fill('https://www.tiktok.com/@user/video/123');
  await page.getByLabel('Target language').selectOption('en');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page).toHaveURL(/\/tasks\/.+/);
});