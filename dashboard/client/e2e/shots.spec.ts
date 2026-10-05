import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Review aid: screenshots of the 3D pipeline / concept views (output is gitignored).
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '__out__');

for (const theme of ['light', 'dark'] as const) {
  test(`pipeline view screenshots ${theme}`, async ({ page }) => {
    test.setTimeout(240_000);
    fs.mkdirSync(OUT, { recursive: true });
    await page.addInitScript((t) => {
      localStorage.setItem('limap.theme', t);
      localStorage.setItem('limap.welcomeSeen', '1');
    }, theme);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, `${theme}__pipe_bridge_height.png`) });

    for (const mode of ['Class', 'Ring', 'Variance']) {
      await page.getByRole('radio', { name: mode, exact: true }).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, `${theme}__pipe_bridge_${mode.replace('.', '')}.png`) });
    }
    await page.getByRole('button', { name: 'Concept view' }).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `${theme}__concept_bridge.png`) });
    await page.getByRole('button', { name: 'Pipeline output' }).click();

    for (const key of ['2', '4', '5']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(2200);
      await page.screenshot({ path: path.join(OUT, `${theme}__pipe_scene${key}.png`) });
    }
  });
}
