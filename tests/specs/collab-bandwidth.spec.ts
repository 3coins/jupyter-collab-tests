import { test, expect } from '../fixtures';

test.describe('bandwidth throttle scenarios', () => {
  test('both clients open the shared notebook', async ({ pageA, pageB }) => {
    // Fixtures have already navigated to /lab?reset and opened the notebook.
    // Verify both clients can see it before any network conditions are applied.
    await expect(pageA.locator('.jp-Notebook')).toBeVisible();
    await expect(pageB.locator('.jp-Notebook')).toBeVisible();
  });

  // TODO: add bandwidth toxic *after* both clients have the notebook open
  // test('bandwidth-throttled client does not block healthy client', ...)
});
