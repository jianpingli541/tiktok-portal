import { test, expect } from '@playwright/test';
import { mockLogin } from './helpers/login';

test('cancel running task', async ({ page }) => {
  await mockLogin(page);
  await page.goto('/tasks');
  await expect(page.getByText('task-1')).toBeVisible();
  await page.getByRole('row', { name: /task-1/ }).getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('row', { name: /task-1/ }).getByText('cancelled')).toBeVisible();
});

test('detail page shows progress and steps', async ({ page }) => {
  await mockLogin(page);
  await page.goto('/tasks/task-1');
  await expect(page.getByText('45%')).toBeVisible();
  await expect(page.getByText('download')).toBeVisible();
});