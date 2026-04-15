import { test as galataTest, expect, galata, IJupyterLabPageFixture } from '@jupyterlab/galata';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.JUPYTER_URL ?? 'http://localhost:8888';

export interface ChatFixtures {
  chatPage: IJupyterLabPageFixture;
}

export const test = galataTest.extend<ChatFixtures>({
  chatPage: async ({}, use) => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ baseURL: BASE_URL });
    const rawPage = await context.newPage();

    const page = galata.addHelpersToPage(
      rawPage,
      BASE_URL,
      async (p) => {
        await p.waitForSelector('.jp-LauncherCard', { timeout: 30_000 });
      },
    );

    await page.goto('');
    await use(page);
    await browser.close();
  },
});

export { expect };
