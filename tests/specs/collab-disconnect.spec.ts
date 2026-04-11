import { test, expect } from '../fixtures';

test.describe('disconnect / reconnect scenarios', () => {
  test('both clients open the shared notebook', async ({ pageA, pageB }) => {
    // Fixtures have already navigated to /lab?reset and opened the notebook.
    // Verify both clients can see it before any network conditions are applied.
    await expect(pageA.locator('.jp-Notebook')).toBeVisible();
    await expect(pageB.locator('.jp-Notebook')).toBeVisible();
  });

  // TODO: disable/re-enable proxy *after* both clients have the notebook open
  // test('client recovers and re-syncs after connection drop', ...)
  // test('healthy client sees edits while other client is disconnected', ...)
});
