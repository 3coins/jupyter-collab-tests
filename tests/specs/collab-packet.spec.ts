import { test, expect } from '../fixtures';

test.describe('packet-level fault scenarios', () => {
  test('both clients open the shared notebook', async ({ pageA, pageB }) => {
    // Fixtures have already navigated to /lab?reset and opened the notebook.
    // Verify both clients can see it before any network conditions are applied.
    await expect(pageA.locator('.jp-Notebook')).toBeVisible();
    await expect(pageB.locator('.jp-Notebook')).toBeVisible();
  });

  // TODO: inject TCP reset / slicer toxics *after* both clients have the notebook open
  // test('TCP reset triggers reconnect and document stays consistent', ...)
  // test('packet fragmentation does not corrupt collaborative state', ...)
});
