import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockDataRoutes } from './mockData';

async function assertNoSeriousViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(
    serious,
    serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)\n  ${v.help}`).join('\n')
  ).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  mockDataRoutes(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText('Test Alpha Model')).toBeVisible();
});

test('main page has no serious accessibility violations (light)', async ({ page }) => {
  await assertNoSeriousViolations(page);
});

test('main page has no serious accessibility violations (dark)', async ({ page }) => {
  const themeBtn = page.getByRole('button', { name: /Switch light, dark, or system/ });
  await themeBtn.click();
  await themeBtn.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await assertNoSeriousViolations(page);
});

test('alternatives modal has no serious accessibility violations', async ({ page }) => {
  await page.getByText('Test Alpha Model').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await assertNoSeriousViolations(page);
});

test('compare modal has no serious accessibility violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Test Alpha Model to comparison' }).click();
  await page.getByRole('button', { name: 'Add Beta Model Two to comparison' }).click();
  await page.getByRole('button', { name: /Compare \(2\)/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await assertNoSeriousViolations(page);
});
