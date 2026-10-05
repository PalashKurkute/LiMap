import { test, expect, type Page } from '@playwright/test';

// The Evidence page must show exactly what the committed result files contain, tagged with provenance.

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem('limap.welcomeSeen', '1'));
  await page.goto('/dashboard/');
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await expect(page.locator('[data-region="evidence"]')).toBeVisible();
}

async function result<T = any>(page: Page, name: string): Promise<T> {
  return (await (await page.request.get(`/data/results/${name}.json`)).json()).data as T;
}

const metric = (page: Page, id: string) => page.locator(`[data-metric="${id}"]`);

test('shows every card with a source line and no unavailable result', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e.message));
  await open(page);

  await expect(page.locator('[data-region="evidence-card"]')).toHaveCount(7); // 6 result cards + limitations
  await expect(page.getByText('could not be loaded')).toHaveCount(0);
  for (const f of ['fidelity_study_results', 'latency_profile_results', 'real_miou_results', 'real_dynamic_mos_results', 'real_regret_results']) {
    await expect(page.getByText(`benchmark/${f}.json`).first()).toBeVisible();
  }
  expect(problems).toEqual([]);
});

test('memory card: both capacity ratios AND the measured occupied-cell ratio are shown together', async ({ page }) => {
  await open(page);
  const f = await result(page, 'fidelity');
  const mc = f.memory_comparison;
  await expect(metric(page, 'capacity-vs-3d')).toHaveText(`${mc.capacity_ratio_vs_3d.ratio.toFixed(1)}×`);
  await expect(metric(page, 'capacity-vs-uniform')).toHaveText(`${mc.capacity_ratio_vs_uniform_25d.ratio.toFixed(1)}×`);
  await expect(metric(page, 'occupied-cell-ratio')).toHaveText(`${mc.occupied_cell_ratio.ratio.toFixed(2)}×`);

  // The three tiles carry their provenance as text.
  const card = page.locator('#ev-memory');
  await expect(card.locator('[data-provenance="CALCULATED"]')).toHaveCount(2);
  await expect(card.locator('[data-provenance="MEASURED"]')).toHaveCount(1);
});

test('speed card: grid-only and end-to-end rates are always shown side by side', async ({ page }) => {
  await open(page);
  const l = await result(page, 'latency');
  const s = l.warm_stages_ms;
  await expect(metric(page, 'fps-grid-p50')).toHaveText(`${(1000 / s.end_to_end_grid_only.p50).toFixed(1)} FPS`);
  await expect(metric(page, 'fps-end-to-end')).toHaveText(`${l.throughput.full_pipeline_sequential_fps_warm.toFixed(2)} FPS`);
  await expect(metric(page, 'fps-async')).toBeVisible();
  // No embedded-hardware numbers are presented.
  const text = await page.locator('#ev-speed').innerText();
  expect(text).not.toMatch(/Jetson.*\d+(\.\d+)? ?ms/);
  expect(text).toContain('no embedded-hardware');
});

test('fidelity card: failing rings are shown as failures, with icon and text', async ({ page }) => {
  await open(page);
  const f = await result(page, 'fidelity');
  const fails = f.per_band_fidelity.filter((b: any) => b.curb_survival_status === 'FAIL');
  expect(fails.length).toBeGreaterThan(0);
  const list = page.locator('#ev-fidelity ul').first();
  await expect(list.getByText('FAIL')).toHaveCount(fails.length);
  await expect(list.locator('svg')).toHaveCount(f.per_band_fidelity.length);
  await expect(page.locator('#ev-fidelity')).toContainText('by construction');
});

test('segmentation card: both mIoU figures and an explicit n/a for the unlabelled far ring', async ({ page }) => {
  await open(page);
  const m = await result(page, 'miou');
  await expect(metric(page, 'miou-present')).toHaveText(`${m.miou_present_classes_pct.toFixed(2)}%`);
  await expect(metric(page, 'miou-all')).toHaveText(`${m.overall_miou_pct.toFixed(2)}%`);
  await expect(metric(page, 'accuracy')).toHaveText(`${m.overall_accuracy_pct.toFixed(2)}%`);
  const empty = m.distance_bands.filter((b: any) => b.total_points === 0).length;
  await expect(page.locator('#ev-segmentation').getByText('no labels', { exact: true })).toHaveCount(empty);
});

test('moving-object and regret cards show the file values and their caveats', async ({ page }) => {
  await open(page);
  const mos = await result(page, 'mos');
  await expect(metric(page, 'mos-recall')).toHaveText(`${mos.classification_metrics.recall_pct}%`);
  await expect(metric(page, 'ghost-cells')).toHaveText(mos.anti_ghosting_metrics.ghost_cells_carved.toLocaleString('en-US'));

  const r = await result(page, 'regret');
  await expect(metric(page, 'regret-mean')).toHaveText(`${r.mean_foveagrid_regret_pct.toFixed(2)}%`);
  await expect(metric(page, 'regret-max')).toHaveText(`${r.max_foveagrid_regret_pct.toFixed(2)}%`);
  await expect(page.locator('#ev-regret')).toContainText('not Nav2');
});

test('every table twin opens and contains the data', async ({ page }) => {
  await open(page);
  const summaries = page.locator('[data-region="evidence"] details > summary');
  // memory (per-ring pool, needs the scene snapshot), fidelity, segmentation, moving-object, regret.
  // Cards load their files asynchronously, so wait for the full set instead of reading the count once.
  await expect(summaries).toHaveCount(5);
  const n = await summaries.count();
  for (let i = 0; i < n; i++) await summaries.nth(i).click();
  await expect(page.locator('[data-region="evidence"] table')).toHaveCount(n);
  for (const t of await page.locator('[data-region="evidence"] table').all()) {
    expect(await t.locator('tbody tr').count()).toBeGreaterThan(0);
  }
});

test('no number on the page is an unsourced literal: removed stale claims are absent', async ({ page }) => {
  await open(page);
  const text = await page.locator('[data-region="evidence"]').innerText();
  for (const banned of ['99.89', '40.2 FPS', '1,899', '9,335', '41.81', 'DRDO', 'PROVED', '0.04%']) {
    expect(text, banned).not.toContain(banned);
  }
});

test('evidence page has no horizontal overflow at laptop widths', async ({ page }) => {
  for (const size of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    await open(page);
    const over = await page.evaluate(() => {
      const el = document.querySelector('[data-region="evidence"]') as HTMLElement;
      return { scroll: el.scrollWidth - el.clientWidth, doc: document.documentElement.scrollWidth - window.innerWidth };
    });
    expect(over.scroll, `evidence overflow at ${size.width}`).toBeLessThanOrEqual(0);
    expect(over.doc).toBeLessThanOrEqual(0);
  }
});

test('evidence page follows the theme (light and dark) including after a live toggle', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('limap.welcomeSeen', '1');
    localStorage.setItem('limap.theme', 'light');
  });
  await page.goto('/dashboard/');
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await expect(page.locator('[data-region="evidence"]')).toBeVisible(); // the view's code loads on demand
  const bg = () => page.evaluate(() => getComputedStyle(document.querySelector('[data-region="evidence"]')!).backgroundColor);
  const light = await bg();
  await page.getByRole('button', { name: /theme \(switch to/ }).click();
  await page.waitForTimeout(300);
  const dark = await bg();
  expect(light).not.toBe(dark);
  // dark surface: all channels well below mid-grey
  const ch = dark.match(/\d+/g)!.slice(0, 3).map(Number);
  expect(Math.max(...ch)).toBeLessThan(90);
  // no large light card left behind inside the dark page
  const lightCards = await page.evaluate(() =>
    [...document.querySelectorAll('[data-region="evidence-card"]')].filter((el) => {
      const [r, g, b] = getComputedStyle(el).backgroundColor.match(/\d+/g)!.map(Number);
      return (r + g + b) / 3 > 140;
    }).length,
  );
  expect(lightCards).toBe(0);
});
