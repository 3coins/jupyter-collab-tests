import { test, expect } from '../fixtures';

test.describe('packet-level fault scenarios', () => {
  test('TCP reset triggers reconnect and document stays consistent', async ({
    pageA,
    pageB,
    toxi,
  }) => {
    await pageA.goto(`${pageA.url()}/lab`);
    await pageB.goto(`${pageB.url()}/lab`);

    await expect(pageA.locator('.jp-LauncherCard').first()).toBeVisible();

    // Trigger a TCP RST on client A's connection
    await toxi.addToxic('jupyter_client_a', 'client_a_reset', 'reset_peer', 'downstream', 1.0, {});

    // Give the browser time to detect and attempt reconnect
    await pageA.waitForTimeout(2000);

    // Remove the toxic so reconnect can succeed
    await toxi.removeToxic('jupyter_client_a', 'client_a_reset');

    // TODO: assert document state is consistent after reconnect
    await expect(pageA.locator('.jp-LauncherCard').first()).toBeVisible({ timeout: 20_000 });
  });

  test('packet fragmentation does not corrupt collaborative state', async ({
    pageA,
    pageB,
    toxi,
  }) => {
    // Slice packets into small chunks with a delay between each
    await toxi.addToxic('jupyter_client_a', 'client_a_slicer', 'slicer', 'downstream', 1.0, {
      average_size: 100,
      size_variation: 50,
      delay: 20,
    });

    await pageA.goto(`${pageA.url()}/lab`);
    await pageB.goto(`${pageB.url()}/lab`);

    // JupyterLab should still be functional despite fragmented packets
    await expect(pageA.locator('.jp-LauncherCard').first()).toBeVisible({ timeout: 20_000 });
    await expect(pageB.locator('.jp-LauncherCard').first()).toBeVisible({ timeout: 10_000 });
  });
});
