import { test, expect } from '@playwright/test';
import { mockLogin } from './helpers/login';

test('upgrade to pro plan', async ({ page }) => {
  await mockLogin(page);
  await page.goto('/billing');
  await page.getByRole('button', { name: 'Choose' }).first().click();
  await expect(page.getByText('Current plan')).toBeVisible();
});