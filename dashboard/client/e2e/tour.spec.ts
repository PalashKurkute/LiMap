import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STEPS } from '../src/tour/steps';
import { N, appState, currentId, goToStep, headerTour, next, popover, ready, seen, tour } from './tour-helpers';

// The guided tour: advanced only by clicking Next, restores the app exactly when it ends, and never touches
// anything the user saved. Runs against `vite preview` with no backend.

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '__out__');

const BANNED = [
  /DRDO\s+(BOUND|requirement|threshold|limit)/i,
  /\bPROVED\b/,
  /Bayesian/i,
  /Kalman/i,
  /collision-free/i,
  /\bguarantee/i,
  /SAFE TO PASS/i,
];

test('the launcher is in the header on every view, and ?tour=1 starts the tour and clears the flag', async ({ page }) => {
  await seen(page);
  await page.goto('/dashboard/');
  for (const v of ['Map Inspector', 'Evidence', '3D Explore']) {
    await page.getByRole('button', { name: v, exact: true }).click();
    await expect(headerTour(page)).toBeVisible();
  }
  await page.goto('/dashboard/?tour=1');
  await ready(page);
  expect(page.url()).not.toContain('tour=1');
  await expect(popover(page)).toContainText(`Step 1 of ${N}`);
  await page.getByRole('button', { name: 'Exit tour' }).click();
  await expect(tour(page)).toHaveCount(0);
});

test('first visit offers the tour once, then stays out of the way', async ({ page }) => {
  await page.goto('/dashboard/');
  const nudge = page.locator('[data-region="tour-nudge"]');
  await expect(nudge).toBeVisible();
  const box = (await nudge.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  await nudge.getByRole('button', { name: 'Not now' }).click();
  await expect(nudge).toBeHidden();
  await page.reload();
  await expect(nudge).toBeHidden();
  await expect(headerTour(page)).toBeVisible();
});

test('nothing advances by itself', async ({ page }) => {
  await seen(page);
  await page.goto('/dashboard/?tour=1');
  await ready(page);
  const first = await currentId(page);
  await page.waitForTimeout(3500);
  expect(await currentId(page)).toBe(first);
  await expect(popover(page)).toContainText(`Step 1 of ${N}`);
});

test('every step: the anchor is on screen, the spotlight sits on it, the popover fits, and the copy is honest', async ({ page }) => {
  test.setTimeout(900_000);
  fs.mkdirSync(OUT, { recursive: true });
  await seen(page);
  await page.addInitScript(() => localStorage.setItem('limap.theme', 'dark'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard/?tour=1');
  await ready(page);

  const visited: string[] = [];
  const texts: string[] = [];
  for (let i = 0; i < N; i++) {
    const id = await currentId(page);
    visited.push(id);
    const step = STEPS.find((s) => s.id === id)!;
    texts.push(await popover(page).innerText());

    const vp = page.viewportSize()!;
    const pb = (await popover(page).boundingBox())!;
    expect(pb.x, `${id} popover left`).toBeGreaterThanOrEqual(0);
    expect(pb.y, `${id} popover top`).toBeGreaterThanOrEqual(0);
    expect(pb.x + pb.width, `${id} popover right`).toBeLessThanOrEqual(vp.width + 1);
    expect(pb.y + pb.height, `${id} popover bottom`).toBeLessThanOrEqual(vp.height + 1);

    if (step.anchor) {
      const anchor = page.locator(step.anchor).first();
      const ab = await anchor.boundingBox();
      expect(ab, `${id} anchor ${step.anchor} must exist`).not.toBeNull();
      const sb = await page.locator('[data-region="tour-spotlight"]').boundingBox();
      expect(sb, `${id} spotlight`).not.toBeNull();
      // The spotlight is the anchor plus its padding, give or take transition and rounding.
      expect(Math.abs(sb!.x - (ab!.x - 6)), `${id} spotlight x`).toBeLessThan(10);
      expect(Math.abs(sb!.y - (ab!.y - 6)), `${id} spotlight y`).toBeLessThan(10);
    }
    // Every secondary anchor that is on screen is lit up as well.
    const extras = await page.locator('[data-region="tour-spotlight-extra"]').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y };
      }),
    );
    for (const sel of step.also ?? []) {
      const eb = await page.locator(sel).first().boundingBox();
      if (!eb || eb.width === 0) continue; // not on screen at this window size: the tour skips it too
      expect(
        extras.some((e) => Math.abs(e.x - (eb.x - 6)) < 10 && Math.abs(e.y - (eb.y - 6)) < 10),
        `${id}: ${sel} is lit up`,
      ).toBe(true);
    }
    await page.screenshot({ path: path.join(OUT, `tour_${String(i).padStart(2, '0')}_${id}.png`) });
    await next(page);
  }

  // Every non-optional step was shown, in order.
  const expected = STEPS.filter((s) => !s.optional).map((s) => s.id);
  expect(visited.filter((id) => expected.includes(id))).toEqual(expected);
  for (const t of texts) for (const re of BANNED) expect(t, `copy must not match ${re}`).not.toMatch(re);
  await expect(tour(page)).toHaveCount(0);
});

test('Back goes back, Esc exits, and the app is exactly as it was (including a non-saved theme change)', async ({ page }) => {
  test.setTimeout(300_000);
  await seen(page);
  await page.addInitScript(() => {
    localStorage.setItem('limap.theme', 'light');
    // Start the tour late so the run is short.
    localStorage.setItem('limap.tour.v2', JSON.stringify({ lastStep: 1, total: 0, done: false }));
  });
  await page.goto('/dashboard/');
  await page.waitForSelector('html[data-ready~="scene-data"]');
  // A state that is not the tour's start state.
  await page.keyboard.press('2');
  await expect(page.locator('[role="group"][aria-label="Scenes"] button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await page.waitForSelector('html[data-ready~="viewport-built"]');
  await page.getByRole('radio', { name: 'Class', exact: true }).click();
  const before = await appState(page);

  await headerTour(page).click();
  await page.getByRole('menuitem', { name: /Start over/ }).click();
  await ready(page);
  await goToStep(page, 'scenes');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect.poll(() => currentId(page)).toBe('intro');
  await ready(page);

  await goToStep(page, 'finish');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark'); // tour switched it, unsaved
  expect(await page.evaluate(() => localStorage.getItem('limap.theme'))).toBe('light'); // saved choice untouched

  await page.keyboard.press('Escape');
  await expect(tour(page)).toHaveCount(0);
  await expect.poll(() => appState(page), { timeout: 60_000 }).toEqual(before);
  await expect(headerTour(page)).toBeFocused();
});

test('app shortcuts are inert while the tour runs and work again afterwards', async ({ page }) => {
  await seen(page);
  await page.goto('/dashboard/?tour=1');
  await ready(page);
  const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.keyboard.press('3');
  await page.keyboard.press('t');
  await page.keyboard.press('T');
  await page.waitForTimeout(500);
  expect(await page.locator('[role="group"][aria-label="Scenes"] button').nth(0).getAttribute('aria-pressed')).toBe('true');
  expect(await page.locator('[data-region="drawer"]').evaluate((e) => e.classList.contains('open'))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(themeBefore);

  await page.keyboard.press('Escape');
  await expect(tour(page)).toHaveCount(0);
  await page.keyboard.press('3');
  await expect(page.locator('[role="group"][aria-label="Scenes"] button').nth(2)).toHaveAttribute('aria-pressed', 'true');
});

test('arrow keys step and a reload offers to resume', async ({ page }) => {
  await seen(page);
  await page.goto('/dashboard/?tour=1');
  await ready(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => currentId(page)).toBe(STEPS[1].id);
  await ready(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => currentId(page)).toBe(STEPS[2].id);
  await ready(page);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => currentId(page)).toBe(STEPS[1].id);
  await page.reload();
  await expect(tour(page)).toHaveCount(0);
  await headerTour(page).click();
  await expect(page.getByRole('menuitem', { name: /Resume at step/ })).toBeVisible();
});

test('while the next step gets ready the popover stays where it was, and never detours through the centre', async ({ page }) => {
  test.setTimeout(300_000);
  await seen(page);
  await page.goto('/dashboard/?tour=1');
  await ready(page);
  for (let i = 0; i < 6; i++) {
    // Record every position the popover is given (its inline style) from now until the next step is ready. The style is
    // read rather than the layout, so a CSS transition cannot hide an intermediate position.
    await page.evaluate(() => {
      const w = window as unknown as { __pops: [number, number][]; __obs?: MutationObserver };
      w.__obs?.disconnect();
      w.__pops = [];
      const el = document.querySelector('[data-region="tour-popover"]') as HTMLElement;
      const record = () => w.__pops.push([parseFloat(el.style.left), parseFloat(el.style.top)]);
      record();
      w.__obs = new MutationObserver(record);
      w.__obs.observe(el, { attributes: true, attributeFilter: ['style'] });
    });
    await next(page);
    const pops = await page.evaluate(() => {
      const w = window as unknown as { __pops: [number, number][]; __obs?: MutationObserver };
      w.__obs?.disconnect();
      return w.__pops;
    });
    const before = pops[0];
    const after = pops[pops.length - 1];
    const at = (p: [number, number], b: [number, number]) => Math.abs(p[0] - b[0]) <= 1 && Math.abs(p[1] - b[1]) <= 1;
    for (const p of pops) expect(at(p, before) || at(p, after), `step ${i + 1}: popover at ${p} is neither where it was (${before}) nor where it goes (${after})`).toBe(true);
  }
});

test('the popover fits a 1280x720 window on the first steps', async ({ page }) => {
  test.setTimeout(300_000);
  await seen(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/dashboard/?tour=1');
  await ready(page);
  for (let i = 0; i < 8; i++) {
    const pb = (await popover(page).boundingBox())!;
    expect(pb.x).toBeGreaterThanOrEqual(0);
    expect(pb.y).toBeGreaterThanOrEqual(0);
    expect(pb.x + pb.width).toBeLessThanOrEqual(1281);
    expect(pb.y + pb.height).toBeLessThanOrEqual(721);
    await next(page);
  }
});

test.describe('with animations on', () => {
  test.use({ reducedMotion: 'no-preference' });

  // Every other test runs with reduced motion. This one lets the spotlight and popover glide between steps and checks
  // the spotlight still settles on its anchor (the Map Inspector steps are cheap to draw, so it runs through those).
  test('the spotlight settles on its anchor as it glides through the Map Inspector steps', async ({ page }) => {
    test.setTimeout(300_000);
    const first = STEPS.findIndex((s) => s.id === 'inspector');
    expect(first).toBeGreaterThan(0);
    await page.addInitScript(
      ([k, n]) => {
        localStorage.setItem('limap.welcomeSeen', '1');
        localStorage.setItem('limap.tour.v2', JSON.stringify({ lastStep: k, total: n, done: false }));
      },
      [first, N],
    );
    await page.goto('/dashboard/');
    await headerTour(page).click();
    await page.getByRole('menuitem', { name: /Resume at step/ }).click();
    await ready(page);

    for (let i = first; i < first + 5; i++) {
      const id = await currentId(page);
      const step = STEPS.find((s) => s.id === id)!;
      expect(id).toBe(STEPS[i].id);
      await expect
        .poll(
          async () => {
            const ab = await page.locator(step.anchor!).first().boundingBox();
            const sb = await page.locator('[data-region="tour-spotlight"]').boundingBox();
            if (!ab || !sb) return Infinity;
            return Math.max(Math.abs(sb.x - (ab.x - 6)), Math.abs(sb.y - (ab.y - 6)));
          },
          { message: `${id}: spotlight settles on the anchor`, timeout: 15_000 },
        )
        .toBeLessThan(4);
      const pb = (await popover(page).boundingBox())!;
      const vp = page.viewportSize()!;
      expect(pb.y, `${id} popover top`).toBeGreaterThanOrEqual(0);
      expect(pb.y + pb.height, `${id} popover bottom`).toBeLessThanOrEqual(vp.height + 1);
      await next(page);
    }
  });
});
