import { test, expect } from '../fixtures';

test.describe('disconnect / reconnect scenarios', () => {
  test('client recovers and re-syncs after connection drop', async ({
    pageA,
    pageB,
    toxi,
  }) => {
    await pageA.goto(`${pageA.url()}/lab`);
    await pageB.goto(`${pageB.url()}/lab`);

    await expect(pageA.locator('.jp-LauncherCard').first()).toBeVisible();
    await expect(pageB.locator('.jp-LauncherCard').first()).toBeVisible();

    // Drop client A's connection
    await toxi.setProxyEnabled('jupyter_client_a', false);

    // Client B makes changes while A is offline
    // TODO: open shared notebook and edit a cell on pageB

    // Reconnect client A
    await toxi.setProxyEnabled('jupyter_client_a', true);

    // Client A should recover and re-sync
    // TODO: assert that pageA sees pageB's changes
    await expect(pageA.locator('.jp-LauncherCard').first()).toBeVisible({ timeout: 20_000 });
  });

  test('healthy client sees edits while other client is disconnected', async ({
    pageA,
    pageB,
    toxi,
  }) => {
    await pageA.goto(`${pageA.url()}/lab`);
    await pageB.goto(`${pageB.url()}/lab`);

    // Disconnect client A — client B should remain fully functional
    await toxi.setProxyEnabled('jupyter_client_a', false);

    // TODO: verify pageB can still open notebooks and edit cells normally

    await toxi.setProxyEnabled('jupyter_client_a', true);
  });
});
