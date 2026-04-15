import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/specs',
  testMatch: 'chat-*.spec.ts',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 1,
  use: {
    baseURL: process.env.JUPYTER_URL ?? 'http://localhost:8888',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  globalSetup: require.resolve('./tests/chat-global-setup'),
  globalTeardown: require.resolve('./tests/chat-global-teardown'),
  reporter: [['list'], ['html', { open: 'never' }]],
});
