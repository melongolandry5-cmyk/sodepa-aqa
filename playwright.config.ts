import { defineConfig, devices } from '@playwright/test';
import { env } from './helpers/env';
import { defaultApiHeaders } from './helpers/http';

/**
 * Configuration Playwright du depot AQA Sodepa.
 *
 * Trois projets :
 *  - `api`          : tests REST purs, un dossier par module sous `api/`.
 *  - `ui-setup`     : authentifie une fois l'UI et serialise la session.
 *  - `ui-chromium`  : tests d'interface, reutilisant la session de `ui-setup`.
 */
export default defineConfig({
  fullyParallel: true,
  forbidOnly: env.isCI,
  retries: env.isCI ? 2 : 0,
  workers: env.isCI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    // consomme par scripts/kiwi-report.mjs (push vers Kiwi TCMS)
    ['json', { outputFile: 'test-results/results.json' }],
    // rapport technique Allure (steps, captures, historique)
    ['allure-playwright', { resultsDir: 'allure-results', detail: true }],
  ],
  use: {
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: defaultApiHeaders(),
  },
  projects: [
    {
      name: 'api',
      testDir: './api',
      testMatch: '**/tests/*.spec.ts',
      use: { baseURL: env.apiBaseUrl },
    },
    {
      name: 'ui-setup',
      testDir: './ui/setup',
      testMatch: /.*\.setup\.ts/,
      use: { baseURL: env.uiBaseUrl, headless: env.headless },
    },
    {
      name: 'ui-chromium',
      testDir: './ui/tests',
      dependencies: ['ui-setup'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: env.uiBaseUrl,
        headless: env.headless,
        storageState: '.auth/user.json',
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
