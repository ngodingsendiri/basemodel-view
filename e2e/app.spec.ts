import { test, expect, type Page } from '@playwright/test';

const API_BASE = 'https://raw.githubusercontent.com/ngodingsendiri/BaseModel/main/dist';
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/ngodingsendiri/BaseModel@main/dist';

const mockModels = {
  models: [
    {
      model_id: 'testco/model-1',
      name: 'Test Alpha Model',
      provider_id: 'testco',
      context_window: 4096,
      max_output_tokens: 2048,
      release_date: '2024-01-01T00:00:00Z',
      modality: ['text'],
      description: 'A test model',
    },
    {
      model_id: 'otherco/model-2',
      name: 'Beta Model Two',
      provider_id: 'otherco',
      context_window: 128000,
      release_date: '2024-06-01T00:00:00Z',
      modality: ['text', 'code'],
      description: 'Another test model',
    },
  ],
};

const mockProviders = {
  providers: [
    { provider_id: 'testco', name: 'Test Company' },
    { provider_id: 'otherco', name: 'Other Company' },
  ],
};

const mockIntelligence = {
  intelligence: [
    {
      model_id: 'testco/model-1',
      cost_tier: 'Free',
      blended_cost_per_1m: 0,
      alternatives: [
        { model_id: 'otherco/model-2', name: 'Beta Model Two', reason: 'Cheaper per token' },
        { model_id: 'testco/model-3', name: 'Gamma Model Three', reason: 'Similar capability' },
        { model_id: 'testco/model-4', name: 'Delta Model Four', reason: 'Good balance' },
        { model_id: 'testco/model-5', name: 'Epsilon Model Five', reason: 'Higher throughput' },
        { model_id: 'testco/model-6', name: 'Zeta Model Six', reason: 'Lower latency' },
      ],
    },
    {
      model_id: 'otherco/model-2',
      cost_tier: 'Premium',
      blended_cost_per_1m: 10,
      alternatives: [],
    },
  ],
};

function mockDataRoutes(page: Page) {
  for (const base of [API_BASE, CDN_BASE]) {
    page.route(`${base}/models.json`, (route) =>
      route.fulfill({ json: mockModels })
    );
    page.route(`${base}/providers.json`, (route) =>
      route.fulfill({ json: mockProviders })
    );
    page.route(`${base}/intelligence.json`, (route) =>
      route.fulfill({ json: mockIntelligence })
    );
  }
}

test.beforeEach(async ({ page }) => {
  mockDataRoutes(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('renders the sidebar and model list', async ({ page }) => {
  await expect(page.locator('.brand-name')).toHaveText('BaseModel');
  await expect(page.getByRole('tab', { name: /All Providers/ })).toBeVisible();
  await expect(page.getByText('Test Alpha Model')).toBeVisible();
  await expect(page.getByText('Beta Model Two')).toBeVisible();
});

test('filters models by provider from the sidebar', async ({ page }) => {
  await page.getByRole('tab', { name: /Test Company/ }).click();
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

test('navigates provider tabs with arrow keys', async ({ page }) => {
  const allTab = page.getByRole('tab', { name: /All Providers/ });
  await allTab.focus();
  await expect(allTab).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('tab', { name: /Test Company/ })).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('tab', { name: /Other Company/ })).toBeFocused();

  await page.keyboard.press('Home');
  await expect(allTab).toBeFocused();
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
