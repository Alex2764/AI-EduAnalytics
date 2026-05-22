import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(rootDir, '.playwright-browsers');

export default defineConfig({
  testDir: './scripts',
  testMatch: 'e2e-*.mjs',
  timeout: 60000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 900 },
  },
});
