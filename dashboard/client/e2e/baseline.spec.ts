import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Captures the CURRENT app (pre-overhaul) as the parity reference.
// Output: e2e/__baseline__/<scene>__<view>[__<tab>].png
const OUT = path.join(__dirname, '__baseline__');
const SCENES = [
  { key: '1', id: 'scene_a_bridge' },
  { key: '2', id: 'scene_b_potholes' },
  { key: '3', id: 'scene_c_moving' },
  { key: '4', id: 'scene_d_poles' },
  { key: '5', id: 'real_seq08_f00' },
];
const TABS = ['View', 'Vehicle', 'Proofs', 'Stress'];

test('capture pre-overhaul baseline', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  // Dismiss the auto-opening onboarding modal
  await page.getByRole('button', { name: 'Close guide' }).click();

  for (const s of SCENES) {
    await page.keyboard.press(s.key);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `${s.id}__hook.png`) });

    // Drawer tabs
    await page.keyboard.press('t');
    await page.waitForTimeout(500);
    for (const tab of TABS) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(OUT, `${s.id}__hook__${tab.toLowerCase()}.png`) });
    }
    await page.keyboard.press('t');

    // Data-inspection screen
    await page.getByRole('button', { name: /Data-Inspection Matrix/ }).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `${s.id}__inspection.png`) });
    await page.getByRole('button', { name: /3D Hook/ }).click();
    await page.waitForTimeout(500);
  }

  fs.writeFileSync(path.join(OUT, 'console-errors.txt'), errors.join('\n') || '(none)');
});
