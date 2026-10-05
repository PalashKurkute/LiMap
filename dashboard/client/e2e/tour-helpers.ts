import { expect, type Page } from '@playwright/test';
import { STEPS } from '../src/tour/steps';

// Shared by tour.spec.ts and tour-recovery.spec.ts (not a spec itself: Playwright only runs *.spec.ts).

export const N = STEPS.length;

export const tour = (page: Page) => page.locator('[data-region="tour"]');
export const popover = (page: Page) => page.locator('[data-region="tour-popover"]');
export const headerTour = (page: Page) =>
  page.locator('[data-region="header"]').getByRole('button', { name: /(Take|Resume) the tour|Resume tour/ });

/** Dismiss the first-visit callout up front, as a returning visitor would have. */
export async function seen(page: Page) {
  await page.addInitScript(() => localStorage.setItem('limap.welcomeSeen', '1'));
}

export async function ready(page: Page) {
  await expect(tour(page)).toHaveAttribute('data-tour-phase', 'ready', { timeout: 90_000 });
}

export async function currentId(page: Page) {
  return (await tour(page).getAttribute('data-tour-step')) as string;
}

export async function next(page: Page) {
  const before = await currentId(page);
  await page.getByRole('button', { name: /^(Next|Finish)$/ }).click();
  if (before === STEPS[N - 1].id) return;
  await expect.poll(() => currentId(page), { timeout: 90_000 }).not.toBe(before);
  await ready(page);
}

export async function goToStep(page: Page, id: string) {
  while ((await currentId(page)) !== id) await next(page);
}

/** The app state a user can see and the storage the tour must not touch. */
export async function appState(page: Page) {
  return page.evaluate(() => {
    const scenePressed = [...document.querySelectorAll('[role="group"][aria-label="Scenes"] button')].map((b) => b.getAttribute('aria-pressed'));
    const colour = [...document.querySelectorAll('[role="radiogroup"][aria-label="Colour by"] [role="radio"]')].find((r) => r.getAttribute('aria-checked') === 'true')?.getAttribute('aria-label') ?? null;
    const view = document.querySelector('nav[aria-label="Views"] [aria-current="page"]')?.textContent ?? null;
    const storage: Record<string, string | null> = {};
    for (const k of Object.keys(localStorage)) if (k !== 'limap.tour.v2' && k !== 'limap.welcomeSeen') storage[k] = localStorage.getItem(k);
    return {
      scenePressed,
      colour,
      view,
      theme: document.documentElement.dataset.theme ?? null,
      drawerOpen: document.querySelector('[data-region="drawer"]')?.classList.contains('open') ?? false,
      storage,
    };
  });
}
