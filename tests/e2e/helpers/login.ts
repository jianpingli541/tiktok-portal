import { Page } from '@playwright/test';

export async function mockLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill('a@b.c');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/submit');
}