import { expect, type Page } from '@playwright/test';

type TestAccount = { email: string; password: string };

export async function login(page: Page, account: TestAccount) {
  await page.goto('/login');
  await page.fill('input[name="email"]', account.email);
  await page.fill('input[name="password"]', account.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
}

export async function selectActiveBaby(page: Page, babyName: string) {
  await page.goto('/dashboard');
  const select = page.getByLabel('Active baby');
  await expect(select).toBeVisible();
  const [selectedBabyId] = await select.selectOption({ label: babyName });
  await page.getByRole('button', { name: 'Switch baby' }).click();
  await expect(page.getByLabel('Active baby')).toHaveValue(selectedBabyId);
}
