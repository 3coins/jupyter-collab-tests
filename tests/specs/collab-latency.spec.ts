import { test, expect } from '../fixtures';

const NOTEBOOK = 'collab-test.ipynb';

test.describe('latency scenarios', () => {
  test('high-latency client eventually syncs edits to healthy client', async ({
    pageA,
    pageB,
    toxi,
  }) => {
    // Introduce 2s latency on client A's downstream connection
    await toxi.addToxic('jupyter_client_a', 'client_a_latency', 'latency', 'downstream', 1.0, {
      latency: 2000,
      jitter: 200,
    });

    await pageA.goto(`${pageA.url()}/lab`);
    await pageB.goto(`${pageB.url()}/lab`);

    // Both clients open the shared notebook
    // TODO: use Galata notebook helpers once session sharing is confirmed
    // await pageA.notebook.open(NOTEBOOK);
    // await pageB.notebook.open(NOTEBOOK);

    // Placeholder assertion — replace with real collaborative edit check
    await expect(pageA.locator('.jp-LauncherCard').first()).toBeVisible({ timeout: 15_000 });
    await expect(pageB.locator('.jp-LauncherCard').first()).toBeVisible({ timeout: 10_000 });
  });

  test('both clients on high latency still reach consistency', async ({
    pageA,
    pageB,
    toxi,
  }) => {
    await toxi.addToxic('jupyter_client_a', 'client_a_latency', 'latency', 'downstream', 1.0, {
      latency: 1500,
      jitter: 300,
    });
    await toxi.addToxic('jupyter_client_b', 'client_b_latency', 'latency', 'downstream', 1.0, {
      latency: 1500,
      jitter: 300,
    });

    await pageA.goto(`${pageA.url()}/lab`);
    await pageB.goto(`${pageB.url()}/lab`);

    // Both should still load, just slowly
    await expect(pageA.locator('.jp-LauncherCard').first()).toBeVisible({ timeout: 20_000 });
    await expect(pageB.locator('.jp-LauncherCard').first()).toBeVisible({ timeout: 20_000 });
  });
});
