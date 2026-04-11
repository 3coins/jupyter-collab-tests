import { test as galataTest, expect } from '@jupyterlab/galata';
import { BrowserContext, Page } from '@playwright/test';
import { ToxiproxyClient } from './toxiproxy-client';

const CLIENT_A_URL = process.env.CLIENT_A_URL ?? 'http://localhost:18888';
const CLIENT_B_URL = process.env.CLIENT_B_URL ?? 'http://localhost:18889';

export interface ChaosFixtures {
  /** Browser page for client A, connected via Toxiproxy port 18888 */
  pageA: Page;
  /** Browser page for client B, connected via Toxiproxy port 18889 */
  pageB: Page;
  /** Ready-to-use Toxiproxy client */
  toxi: ToxiproxyClient;
}

export const test = galataTest.extend<ChaosFixtures>({
  toxi: async ({}, use) => {
    const client = new ToxiproxyClient();
    await use(client);
    // Reset all toxics after every test so state never bleeds between tests
    await client.resetAll();
  },

  pageA: async ({ browser }, use) => {
    const context: BrowserContext = await browser.newContext({
      baseURL: CLIENT_A_URL,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  pageB: async ({ browser }, use) => {
    const context: BrowserContext = await browser.newContext({
      baseURL: CLIENT_B_URL,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
