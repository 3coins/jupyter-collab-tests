import { test, expect } from '../fixtures';

test.describe('latency scenarios', () => {
  test('both clients open the shared notebook', async ({ pageA, pageB }) => {
    // Fixtures have already navigated to /lab?reset and opened the notebook.
    // Verify both clients can see it before any network conditions are applied.
    await expect(pageA.locator('.jp-Notebook')).toBeVisible();
    await expect(pageB.locator('.jp-Notebook')).toBeVisible();
  });

  // TODO: apply latency toxics *after* both clients have the notebook open
  // test('high-latency client eventually syncs edits to healthy client', ...)
  // test('both clients on high latency still reach consistency', ...)
});
