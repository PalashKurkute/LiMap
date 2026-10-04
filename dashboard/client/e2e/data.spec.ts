import { test, expect, type Page } from '@playwright/test';

// Data-source behaviour on the deployed link: snapshot first, honest when nothing is available,
// and upgrading to the live API only when it really has data.

async function boot(page: Page) {
  await page.addInitScript(() => localStorage.setItem('limap.welcomeSeen', '1'));
}
const errors = (page: Page) => {
  const out: string[] = [];
  page.on('pageerror', (e) => out.push(e.message));
  return out;
};

test('snapshot data drives the 3D card, status bar and inspector with no backend', async ({ page }) => {
  await boot(page);
  const problems = errors(page);
  await page.goto('/');
  await expect(page.locator('[data-region="data-source"]')).toContainText('Snapshot');
  await expect(page.locator('[data-region="statusbar"]')).toContainText('ACTIVE CELLS: 47,307 / 106,875');
  await expect(page.locator('[data-region="statusbar"]')).toContainText('LABELS: gt');
  await expect(page.locator('[data-region="scene-card"]')).toContainText('MIN CLEARANCE');

  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  await expect(page.getByText(/40,000 shown/)).toBeVisible();
  expect(problems).toEqual([]);
});

test('clicking a cell in the map inspector selects it and shows its statistics', async ({ page }) => {
  await boot(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  await expect(page.locator('[data-region="inspector-legend"]')).toBeVisible();

  const canvas = page.locator('[data-region="inspector-canvas"] canvas');
  // The canvas must be sized and drawn before a click maps to world coordinates.
  await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width), { timeout: 15000 }).toBeGreaterThan(0);
  const box = (await canvas.boundingBox())!;
  // 12 m ahead of the ego marker at the default zoom: inside the dense ring-0/ring-1 ground cells.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 12 * 6);
  await expect(page.getByText(/ix: -?\d+, iy: -?\d+/)).toBeVisible();
  await expect(page.getByText('Resolution ring', { exact: true })).toBeVisible();
  await expect(page.getByText('Welford variance', { exact: true })).toBeVisible();
});

test('every scene has a snapshot with cells (including the real scene)', async ({ page }) => {
  await boot(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  for (const key of ['1', '2', '3', '4', '5']) {
    await page.keyboard.press(key);
    // Generous: the headless browser software-renders WebGL and can be CPU-starved right after a view switch.
    await expect(page.locator('[data-region="inspector-legend"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-region="data-source"]')).toContainText('Snapshot');
  }
});

test('snapshot files missing: honest empty state, no crash, no invented data', async ({ page }) => {
  await boot(page);
  const problems = errors(page);
  await page.route('**/data/scenes/**', (r) => r.fulfill({ status: 404, body: 'nope' }));
  await page.goto('/');
  await expect(page.locator('[data-region="data-source"]')).toContainText('No scene data');
  await expect(page.locator('[data-region="statusbar"]')).toContainText('no scene data');
  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  await expect(page.getByText('No grid cells are available')).toBeVisible();
  await expect(page.locator('[data-region="inspector-legend"]')).toBeHidden();
  expect(problems).toEqual([]);
});

test('deployed API without scene data (503) keeps the snapshot', async ({ page }) => {
  await boot(page);
  await page.route('**/api/health', (r) => r.fulfill({ json: { status: 'ONLINE', active_cells: 0 } }));
  await page.route('**/api/load_scene/**', (r) =>
    r.fulfill({ status: 503, json: { detail: { code: 'SCENE_DATA_MISSING', message: 'missing' } } }),
  );
  await page.goto('/');
  await expect(page.locator('[data-region="data-source"]')).toContainText('Snapshot');
  await page.waitForTimeout(800);
  await expect(page.locator('[data-region="data-source"]')).toContainText('Snapshot'); // still, after the API answered
  await expect(page.getByText('API online')).toBeVisible();
});

test('live API with data upgrades the view in place', async ({ page }) => {
  await boot(page);
  const snap = await (await page.request.get('/data/scenes/scene_a_bridge.json')).json();
  await page.route('**/api/health', (r) => r.fulfill({ json: { status: 'ONLINE' } }));
  await page.route('**/api/load_scene/**', (r) => r.fulfill({ json: { status: 'SUCCESS', label_source: 'gt' } }));
  await page.route('**/api/telemetry', (r) =>
    r.fulfill({ json: { ...snap.telemetry, telemetry: { ...snap.telemetry.telemetry, active_cells: 3 } } }),
  );
  await page.route('**/api/cross_section', (r) => r.fulfill({ json: snap.cross_section }));
  await page.route('**/api/grid_cells**', (r) =>
    r.fulfill({
      json: {
        total_active: 3,
        sampled: false,
        cells: [0, 1, 2].map((i) => ({
          ix: i, iy: i, ring_id: 0, res_m: 0.05, x_m: i * 0.05 + 2, y_m: 0, sem_id: 40, count: 5, mean_z: -1.7,
          variance: 0.001, min_z: -1.71, max_z: -1.69, overhang_z: null, clearance: null,
        })),
      },
    }),
  );
  await page.goto('/');
  await expect(page.locator('[data-region="data-source"]')).toContainText('Live API');
  await expect(page.locator('[data-region="statusbar"]')).toContainText('ACTIVE CELLS: 3 /');
  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  await expect(page.getByText('LIVE API', { exact: true })).toBeVisible();
});

test('a hung API never blocks the snapshot', async ({ page }) => {
  await boot(page);
  await page.route('**/api/**', () => {
    /* never respond */
  });
  const t0 = Date.now();
  await page.goto('/');
  await expect(page.locator('[data-region="data-source"]')).toContainText('Snapshot', { timeout: 5000 });
  expect(Date.now() - t0).toBeLessThan(6000);
});

test('benchmark results are served as static files with provenance', async ({ page }) => {
  for (const name of ['fidelity', 'latency', 'miou', 'mos', 'regret', 'edge_profile']) {
    const res = await page.request.get(`/data/results/${name}.json`);
    expect(res.ok(), name).toBe(true);
    const env = await res.json();
    expect(env.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(env.source_path).toMatch(/^benchmark\/.*\.json$/);
    expect(env.data).toBeTruthy();
  }
});
