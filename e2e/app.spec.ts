import { test, expect } from '@playwright/test';
import { mockDataRoutes } from './mockData';

test.beforeEach(async ({ page }) => {
  mockDataRoutes(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('renders the sidebar and model list', async ({ page }) => {
  await expect(page.locator('.brand-name')).toHaveText('BaseModel');
  await expect(page.getByRole('button', { name: /All Providers/ })).toBeVisible();
  await expect(page.getByText('Test Alpha Model')).toBeVisible();
  await expect(page.getByText('Beta Model Two')).toBeVisible();
});

test('filters models by provider from the sidebar', async ({ page }) => {
  await page.getByRole('button', { name: /Test Company/ }).click();
  await expect(page.getByText('Test Alpha Model')).toBeVisible();
  await expect(page.getByText('Beta Model Two')).toHaveCount(0);
});

test('filters models by search query', async ({ page }) => {
  await page.getByLabel('Filter models').fill('beta');
  await expect(page.getByText('Beta Model Two')).toBeVisible();
  await expect(page.getByText('Test Alpha Model')).toHaveCount(0);
});

test('toggles free-only filter', async ({ page }) => {
  await page.getByLabel('Free only').check();
  await expect(page.getByText('Test Alpha Model')).toBeVisible();
  await expect(page.getByText('Beta Model Two')).toHaveCount(0);
});

test('opens the alternatives modal on model click', async ({ page }) => {
  await page.getByText('Test Alpha Model').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Suggested Alternatives/)).toBeVisible();
  await expect(dialog.getByText('Beta Model Two')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('opens the alternatives modal via URL deep link', async ({ page }) => {
  await page.goto('/?alt=testco%2Fmodel-1');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Test Alpha Model')).toBeVisible();
});

test('clears all filters with the clear filters button', async ({ page }) => {
  await page.getByLabel('Filter models').fill('beta');
  await expect(page.getByText('Beta Model Two')).toBeVisible();
  await expect(page.getByText('Test Alpha Model')).toHaveCount(0);

  await page.getByRole('button', { name: /Clear filters/ }).click();
  await expect(page.getByText('Test Alpha Model')).toBeVisible();
  await expect(page.getByText('Beta Model Two')).toBeVisible();
});

test('displays price per 1M tokens on paid models', async ({ page }) => {
  await expect(page.getByText('$10.00 /1M')).toBeVisible();
});

test('navigates to an alternative model from the modal', async ({ page }) => {
  await page.getByText('Test Alpha Model').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: /View details for Beta Model Two/ }).click({ position: { x: 60, y: 20 } });
  await expect(page.locator('.modal-title')).toHaveText('Beta Model Two');
  await expect(dialog.getByText('$10.00 /1M')).toBeVisible();
});

test('compares two models side by side', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Test Alpha Model to comparison' }).click();
  await page.getByRole('button', { name: 'Add Beta Model Two to comparison' }).click();

  await expect(page.getByText('2 selected')).toBeVisible();
  await page.getByRole('button', { name: /Compare \(2\)/ }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Compare models')).toBeVisible();
  await expect(dialog.getByText('$10.00 /1M')).toBeVisible();
  await expect(dialog.getByRole('cell', { name: 'Premium' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Remove Test Alpha Model from comparison' }).click();
  await expect(dialog.getByRole('cell', { name: 'Test Alpha Model' })).toHaveCount(0);
  await expect(dialog.getByText('Beta Model Two')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('expands alternative suggestions beyond the first three', async ({ page }) => {
  await page.getByText('Test Alpha Model').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await expect(dialog.getByRole('button', { name: /View details for Zeta Model Six/ })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Show 2 more' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Show 2 more' }).click();
  await expect(dialog.getByRole('button', { name: /View details for Zeta Model Six/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Show 2 more' })).toHaveCount(0);
});

test('closes the modal when the browser Back button is pressed', async ({ page }) => {
  await page.getByText('Test Alpha Model').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/alt=testco%2Fmodel-1/);

  await page.goBack();
  await expect(dialog).toBeHidden();
});

test('persists compare selection across reloads via the URL', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Test Alpha Model to comparison' }).click();
  await page.getByRole('button', { name: 'Add Beta Model Two to comparison' }).click();
  await expect(page.getByText('2 selected')).toBeVisible();
  await expect(page).toHaveURL(/compare=/);

  await page.reload();
  await expect(page.getByText('2 selected')).toBeVisible();
  await expect(page).toHaveURL(/compare=/);

  await page.getByRole('button', { name: /Compare \(2\)/ }).click();
  await expect(page.getByRole('dialog').getByText('Compare models')).toBeVisible();
});

test('shows Free pricing and highlights the best value in the compare table', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Test Alpha Model to comparison' }).click();
  await page.getByRole('button', { name: 'Add Beta Model Two to comparison' }).click();
  await page.getByRole('button', { name: /Compare \(2\)/ }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('td.compare-best', { hasText: 'Free' })).toBeVisible();
  await expect(dialog.getByRole('cell', { name: '128k tokens' })).toHaveClass(/compare-best/);
});

test('cycles the theme system -> light -> dark -> system and persists it', async ({ page }) => {
  const themeBtn = page.getByRole('button', { name: /Switch light, dark, or system/ });

  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /light|dark/);

  await themeBtn.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await themeBtn.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await themeBtn.click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /light|dark/);

  await themeBtn.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await themeBtn.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('collapses the sidebar to an icon rail and persists it', async ({ page }) => {
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(page.locator('.sidebar')).toHaveClass(/sidebar--collapsed/);
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();

  await page.reload();
  await expect(page.locator('.sidebar')).toHaveClass(/sidebar--collapsed/);

  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await expect(page.locator('.sidebar')).not.toHaveClass(/sidebar--collapsed/);
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
});

test('exports the filtered view as a CSV download', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export CSV/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^basemodel-\d{4}-\d{2}-\d{2}\.csv$/);

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const content = Buffer.concat(chunks).toString('utf8');

  expect(content).toContain('"Name"');
  expect(content).toContain('"Test Alpha Model"');
  expect(content).toContain('"Beta Model Two"');
});

test('skip link moves focus to the models panel', async ({ page }) => {
  const skipLink = page.locator('.skip-link');
  await expect(skipLink).not.toBeFocused();

  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.locator('#models-panel')).toBeFocused();
});

test('"/" shortcut focuses the search box', async ({ page }) => {
  await expect(page.getByText('Test Alpha Model')).toBeVisible();

  // Dispatched in-page because Chromium intercepts a raw "/" press for its
  // find-in-page quick find.
  await page.evaluate(() => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
  });
  await expect(page.locator('#search-input')).toBeFocused();
});

test('copy link button copies the filtered URL to the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-write', 'clipboard-read']);

  await page.getByLabel('Filter models').fill('beta');
  await expect(page).toHaveURL(/q=beta/);

  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(copied).searchParams.get('q')).toBe('beta');
});

test('shows the last-updated timestamp once data loads', async ({ page }) => {
  await expect(page.locator('.last-updated')).toContainText('Updated');
});
