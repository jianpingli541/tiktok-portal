import { test, expect } from '@playwright/test';

test('register then login flow', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Email').fill('new@user.com');
  await page.getByLabel(/Password/).fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/verify-email/);

  await page.goto('/login');
  await page.getByLabel('Email').fill('new@user.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/submit/);
});