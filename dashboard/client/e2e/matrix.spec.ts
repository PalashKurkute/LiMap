import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Screenshot matrix: every scene x view x theme. Fails on any page error / unexpected console error.
// Images land in e2e/__out__/ (gitignored) for visual review against e2e/__baseline__/.
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '__out__');
const SCENES = ['1', '2', '3', '4', '5'];

function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location().url ?? '';
    if (/\/api\//.test(url)) return; // backend intentionally absent in this suite
    problems.push(`console.error: ${m.text()} (${url})`);
  });
  return problems;
}

for (const theme of ['light', 'dark'] as const) {
  test(`matrix ${theme}: all scenes x (3D, inspector, drawer)`, async ({ page }) => {
    test.setTimeout(300_000); // software-rendered WebGL in the test browser
    fs.mkdirSync(OUT, { recursive: true });
    const problems = watch(page);
    await page.addInitScript((t) => {
      localStorage.setItem('limap.theme', t);
      localStorage.setItem('limap.welcomeSeen', '1');
    }, theme);
    await page.goto('/');

    for (const key of SCENES) {
      await page.keyboard.press(key);
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUT, `${theme}__scene${key}__3d.png`) });

      await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `${theme}__scene${key}__inspector.png`) });
      await page.getByRole('button', { name: '3D Explore', exact: true }).click();
    }

    await page.keyboard.press('t');
    await page.waitForTimeout(400);
    for (const tab of ['View', 'Vehicle', 'Proofs', 'Stress']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, `${theme}__drawer_${tab.toLowerCase()}.png`) });
    }
    expect(problems).toEqual([]);
  });

  test(`matrix ${theme}: welcome dialog steps`, async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    const problems = watch(page);
    await page.addInitScript((t) => localStorage.setItem('limap.theme', t), theme);
    await page.goto('/');
    for (let i = 1; i <= 4; i++) {
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(OUT, `${theme}__welcome_${i}.png`) });
      if (i < 4) await page.getByRole('button', { name: 'Next' }).click();
    }
    expect(problems).toEqual([]);
  });
}
