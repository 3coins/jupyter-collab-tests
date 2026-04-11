import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Run tests serially — each test manipulates shared Toxiproxy state
  workers: 1,
  use: {
    // Default URL for the built-in galata `page` fixture (direct, no proxy)
    baseURL: process.env.JUPYTER_URL ?? 'http://localhost:8888',
    // Keep traces on failure for debugging
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),
  reporter: [['list'], ['html', { open: 'never' }]],
});
