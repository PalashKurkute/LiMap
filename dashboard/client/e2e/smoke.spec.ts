import { test, expect, type Page } from '@playwright/test';

// Runs against `vite preview` with NO backend (Vercel-cold / empty mode).
// Any page error or unexpected console error fails the run. Expected no-backend /api failures are ignored.

const SCENES = ['1', '2', '3', '4', '5'];

function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location().url ?? '';
    if (/\/api\//.test(url)) return; // backend intentionally absent
    problems.push(`console.error: ${m.text()} (${url})`);
  });
  page.on('requestfailed', (r) => {
    if (/\/api\//.test(r.url())) return;
    problems.push(`requestfailed: ${r.url()}`);
  });
  return problems;
}

async function dismissWelcome(page: Page) {
  const nudge = page.locator('[data-region="tour-nudge"]');
  if (await nudge.isVisible().catch(() => false)) await nudge.getByRole('button', { name: 'Not now' }).click();
}

test('the first visit offers the tour once, then stays out of the way', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/');
  const nudge = page.locator('[data-region="tour-nudge"]');
  await expect(nudge).toBeVisible();
  await nudge.getByRole('button', { name: 'Not now' }).click();
  await expect(nudge).toBeHidden();
  await page.reload();
  await expect(nudge).toBeHidden();
  expect(problems).toEqual([]);
});

test('every scene renders in both views without errors', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/');
  await dismissWelcome(page);

  for (const key of SCENES) {
    await page.keyboard.press(key);
    await page.waitForTimeout(700);
    await expect(page.locator('canvas').first()).toBeVisible();

    await page.getByRole('button', { name: /Data-Inspection|Map Inspector/ }).first().click();
    await page.waitForTimeout(300);
    // Cells come from the precomputed snapshot even though there is no backend.
    await expect(page.locator('[data-region="inspector-legend"]')).toBeVisible();
    await expect(page.getByText('PRECOMPUTED SNAPSHOT')).toBeVisible();
    await expect(page.getByText('No grid cells are available')).toBeHidden();
    await page.getByRole('button', { name: /3D Hook|3D Explore/ }).first().click();
  }
  expect(problems).toEqual([]);
});

test('drawer tabs open and no fabricated claims are shown', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/');
  await dismissWelcome(page);
  await page.keyboard.press('t');

  for (const tab of ['Layers', 'Vehicle', 'Section', 'Stress']) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await page.waitForTimeout(150);
  }
  const text = await page.locator('body').innerText();
  for (const banned of ['DRDO BOUND', 'PROVED', '99.89', '40.2 FPS', '1,899', 'SAFE TO PASS', 'O(1) Bound']) {
    expect(text, `body must not contain "${banned}"`).not.toContain(banned);
  }
  expect(problems).toEqual([]);
});

test.describe('normal motion', () => {
test.use({ reducedMotion: 'no-preference' });

test('keyboard: Space toggles playback, arrows step, Esc closes the drawer', async ({ page }) => {
  await page.goto('/');
  await dismissWelcome(page);
  await page.getByRole('button', { name: 'Concept view' }).click(); // the illustrative drive only exists in concept mode
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); // Space on a focused button activates that button

  const playBtn = page.getByRole('button', { name: /^(Pause|Play)$/ });
  await expect(playBtn).toHaveText(/Pause/);
  await page.keyboard.press(' ');
  await expect(playBtn).toHaveText(/Play/);

  const frameLabel = page.getByText(/Frame: \d+ \/ 120/);
  const before = await frameLabel.innerText();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(250);
  expect(await frameLabel.innerText()).not.toBe(before);

  await page.keyboard.press('t');
  await expect(page.locator('[data-region="drawer"]').getByText('Controls', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await expect(page.locator('.telemetry-drawer')).toHaveClass(/closed/);
});
});

test.describe('reduced motion', () => {
  test('playback starts paused and Space still starts it', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('limap.welcomeSeen', '1'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Concept view' }).click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); // Space on a focused button activates that button
    const playBtn = page.getByRole('button', { name: /^(Pause|Play)$/ });
    await expect(playBtn).toHaveText(/Play/);
    await page.keyboard.press(' ');
    await expect(playBtn).toHaveText(/Pause/);
  });
});
