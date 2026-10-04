import { defineConfig } from '@playwright/test';

// Runs against `vite preview` with NO backend, which mimics a cold / empty Vercel deploy.
// Set BASE_URL to test a deployed preview instead.
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    // The headless browser software-renders WebGL; reduced motion keeps the 3D view idle-cheap so tests stay fast and
    // deterministic. Autoplay behaviour is covered explicitly with reducedMotion: 'no-preference'.
    reducedMotion: 'reduce',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
