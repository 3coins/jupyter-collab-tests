import { test, expect } from '../fixtures';

test.describe('bandwidth throttle scenarios', () => {
  test('bandwidth-throttled client does not block healthy client', async ({
    pageA,
    pageB,
    toxi,
  }) => {
    // Throttle client A to ~10 KB/s (very slow)
    await toxi.addToxic('jupyter_client_a', 'client_a_throttle', 'bandwidth', 'downstream', 1.0, {
      rate: 10,
    });

    await pageA.goto(`${pageA.url()}/lab`);
    await pageB.goto(`${pageB.url()}/lab`);

    // Client B (unthrottled) should load at normal speed
    await expect(pageB.locator('.jp-LauncherCard').first()).toBeVisible({ timeout: 10_000 });

    // Client A should eventually load too, just slower
    await expect(pageA.locator('.jp-LauncherCard').first()).toBeVisible({ timeout: 30_000 });
  });
});
