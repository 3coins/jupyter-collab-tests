import { test as galataTest, expect, galata, IJupyterLabPageFixture } from '@jupyterlab/galata';
import { BrowserContext, Page, chromium } from '@playwright/test';
import { ToxiproxyClient } from './toxiproxy-client';

const CLIENT_A_URL = process.env.CLIENT_A_URL ?? 'http://localhost:18888';
const CLIENT_B_URL = process.env.CLIENT_B_URL ?? 'http://localhost:18889';
const NOTEBOOK_PATH = 'collab-test.ipynb';

const FIXTURE_TIMEOUT_MS = 15_000;
const WINDOW_WIDTH = 960;
const WINDOW_HEIGHT = 1080;

export interface ChaosFixtures {
  /** Browser page for client A, positioned on the left half of the screen */
  pageA: Page;
  /** Browser page for client B, positioned on the right half of the screen */
  pageB: Page;
  /**
   * Galata-augmented page for client A, landed on the Launcher (no notebook
   * pre-opened). Use this when the test itself creates or chooses the notebook.
   */
  freshPageA: IJupyterLabPageFixture;
  /**
   * Galata-augmented page for client B, landed on the Launcher (no notebook
   * pre-opened). Use this when the test itself creates or chooses the notebook.
   */
  freshPageB: IJupyterLabPageFixture;
  /** Ready-to-use Toxiproxy client */
  toxi: ToxiproxyClient;
}

/**
 * Launch a headed Chromium window at the given X offset, reset the JupyterLab
 * workspace, then open the shared notebook.  Returns the page and a cleanup fn.
 */
async function launchAndOpenNotebook(
  baseURL: string,
  windowX: number,
): Promise<{ page: Page; cleanup: () => Promise<void> }> {
  const browser = await chromium.launch({
    headless: false,
    args: [
      `--window-position=${windowX},0`,
      `--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`,
    ],
  });

  const context: BrowserContext = await browser.newContext({ baseURL });
  const page = await context.newPage();

  // ?reset clears the workspace layout and avoids leftover-tab popups from
  // a previous session (e.g. "restore tabs?" dialogs)
  await page.goto('/lab?reset');
  // Wait for the Launcher to confirm JupyterLab finished initialising
  await page.waitForSelector('.jp-LauncherCard', { timeout: 15_000 });

  // Open the shared notebook via its tree URL
  await page.goto(`/lab/tree/${NOTEBOOK_PATH}`);
  // Wait for the notebook DOM to be present
  await page.waitForSelector('.jp-Notebook', { timeout: 15_000 });

  return { page, cleanup: () => browser.close() };
}

/**
 * Launch a headed Chromium window at the given X offset and navigate to the
 * JupyterLab launcher (workspace reset).  The raw page is wrapped with
 * galata.addHelpersToPage so that page.notebook, page.menu, etc. are available.
 * No notebook is opened — the test is responsible for that.
 */
async function launchToLauncher(
  baseURL: string,
  windowX: number,
): Promise<{ page: IJupyterLabPageFixture; cleanup: () => Promise<void> }> {
  const browser = await chromium.launch({
    headless: false,
    args: [
      `--window-position=${windowX},0`,
      `--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`,
    ],
  });

  const context: BrowserContext = await browser.newContext({ baseURL });
  const rawPage = await context.newPage();

  // Wrap the raw Playwright page with all Galata helpers (page.notebook, etc.)
  const page = galata.addHelpersToPage(
    rawPage,
    baseURL,
    async (p) => { await p.waitForSelector('.jp-LauncherCard', { timeout: 15_000 }); },
  );

  // Galata's goto prepends baseURL + appPath (/lab) automatically.
  // Pass empty string to navigate to /lab/ without ?reset, which can cause
  // a redirect that interrupts Galata's waitForAppStarted poll.
  await page.goto('');

  return { page, cleanup: () => browser.close() };
}

export const test = galataTest.extend<ChaosFixtures>({
  toxi: async ({}, use) => {
    const client = new ToxiproxyClient();
    await use(client);
    // Reset all toxics after every test so state never bleeds between tests
    await client.resetAll();
  },

  pageA: async ({}, use) => {
    const { page, cleanup } = await launchAndOpenNotebook(CLIENT_A_URL, 0);
    await use(page);
    await cleanup();
  },

  pageB: async ({}, use) => {
    const { page, cleanup } = await launchAndOpenNotebook(CLIENT_B_URL, WINDOW_WIDTH);
    await use(page);
    await cleanup();
  },

  freshPageA: async ({}, use) => {
    const { page, cleanup } = await launchToLauncher(CLIENT_A_URL, 0);
    await use(page);
    await cleanup();
  },

  freshPageB: async ({}, use) => {
    const { page, cleanup } = await launchToLauncher(CLIENT_B_URL, WINDOW_WIDTH);
    await use(page);
    await cleanup();
  },
});

export { expect };
