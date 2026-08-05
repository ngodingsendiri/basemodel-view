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

test('sorts by benchmark ranking and shows rank chips', async ({ page }) => {
  await page.selectOption('#sort-select', 'rank:code');

  // Alpha scores 92 vs Beta 68 -> Alpha first. (Colon is URL-encoded.)
  await expect(page).toHaveURL(/sort=rank%3Acode/);
  const cards = page.locator('.model-card');
  await expect(cards.first()).toContainText('Test Alpha Model');

  // Rank chips visible while ranking sort is active.
  await expect(page.locator('.rank-chip').first()).toContainText('#1 · 92');

  // Ranking section appears in the details modal.
  await page.getByText('Test Alpha Model').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Rankings')).toBeVisible();
  await expect(dialog.getByText('Code #1 · 92')).toBeVisible();
});

test('persists ranking sort across reloads via the URL', async ({ page }) => {
  await page.goto('/?sort=rank%3Acode');
  await expect(page.getByText('Test Alpha Model')).toBeVisible();
  await expect(page.locator('.rank-chip').first()).toContainText('#1 · 92');
  await expect(page.locator('#sort-select')).toHaveValue('rank:code');
  await expect(page).toHaveURL(/sort=rank%3Acode/);
});

test('opens the model detail modal on model click', async ({ page }) => {
  await page.getByText('Test Alpha Model').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Available Providers \(2\)/)).toBeVisible();
  await expect(dialog.getByText('Test Company')).toBeVisible();
  await expect(dialog.getByText('Other Company')).toBeVisible();
  // Alias chips from the canonical model are rendered.
  await expect(dialog.getByText('alpha-one')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('opens the detail modal via canonical deep link', async ({ page }) => {
  await page.goto('/?alt=model-1');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Test Alpha Model')).toBeVisible();
});

test('opens the detail modal via legacy offering-id deep link', async ({ page }) => {
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

test('displays cheapest price per 1M tokens on paid models', async ({ page }) => {
  await expect(page.getByText(/from \$10\.00 \/1M/)).toBeVisible();
});

test('shows quality, Pareto, and New chips on ranked models', async ({ page }) => {
  const card = page.locator('.model-card', { hasText: 'Test Alpha Model' });
  // Quality chip (Pareto star) + New badge from changes.json.
  await expect(card.locator('.quality-chip--pareto')).toContainText('★ 88.5');
  await expect(card.locator('.new-chip')).toBeVisible();
  // Provider-count chip from the offerings dataset.
  await expect(card.locator('.stat-chip', { hasText: '2 prov' })).toBeVisible();
});

test('highlights the best-price offering in the detail modal', async ({ page }) => {
  await page.getByText('Test Alpha Model').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Free offering drives the resolved price -> highlighted as best.
  await expect(dialog.locator('.alt-item--best', { hasText: 'Test Company' })).toBeVisible();
  await expect(dialog.locator('.best-offer-chip')).toHaveText('Best price');
  await expect(dialog.getByText(/88\.5 \/ 100/)).toBeVisible();
  await expect(dialog.locator('.pareto-star')).toBeVisible();
});

test('sorts by quality best first', async ({ page }) => {
  await page.selectOption('#sort-select', 'quality');
  await expect(page).toHaveURL(/sort=quality/);

  const cards = page.locator('.model-card');
  await expect(cards.first()).toContainText('Test Alpha Model'); // 88.5 > 70
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
  // Providers + Quality rows come from the v2 dataset.
  await expect(dialog.getByRole('cell', { name: 'Test Company, Other Company' })).toBeVisible();
  await expect(dialog.getByRole('cell', { name: '88.5 / 100' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Remove Test Alpha Model from comparison' }).click();
  await expect(dialog.getByRole('cell', { name: 'Test Alpha Model' })).toHaveCount(0);
  await expect(dialog.getByText('Beta Model Two')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('lists every provider offering in the detail modal', async ({ page }) => {
  await page.getByText('Test Alpha Model').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Both offerings listed with their ids; the priced one shows its price.
  await expect(dialog.getByText('testco/model-1')).toBeVisible();
  await expect(dialog.getByText('otherco/model-1')).toBeVisible();
  await expect(dialog.getByText(/2 providers/)).toBeVisible();
});

test('closes the modal when the browser Back button is pressed', async ({ page }) => {
  await page.getByText('Test Alpha Model').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/alt=model-1/);

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
