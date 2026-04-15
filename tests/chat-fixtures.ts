import { test as galataTest, expect, galata, IJupyterLabPageFixture } from '@jupyterlab/galata';

const BASE_URL = process.env.JUPYTER_URL ?? 'http://localhost:8888';

export interface ChatFixtures {
  chatPage: IJupyterLabPageFixture;
}

export const test = galataTest.extend<ChatFixtures>({
  chatPage: async ({ context }, use) => {
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
  },
});

export { expect };
