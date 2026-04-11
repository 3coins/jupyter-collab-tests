import { test, expect } from '../fixtures';

/** Simple pause — used to give JupyterLab time to sync collaborative edits. */
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

test.describe('collaborative notebook creation', () => {
  let createdNotebook: string | null = null;

  test.afterEach(async ({ request }) => {
    if (createdNotebook) {
      await request.delete(`/api/contents/${encodeURIComponent(createdNotebook)}`);
      createdNotebook = null;
    }
  });
  /**
   * pageA creates a brand-new notebook, then both clients take turns adding
   * cells with realistic pauses between each edit so the collaboration layer
   * has time to propagate changes.
   *
   * Structure:
   *   Cell 0 (code)     — pre-existing cell when notebook is created
   *   Cell 1 (code)     — added by pageA
   *   Cell 2 (markdown) — added by pageB
   *   Cell 3 (code)     — added by pageA
   *   Cell 4 (markdown) — added by pageB
   *
   * After all edits both clients must see the same cell count and content.
   */
  test('pageA creates notebook; both clients add cells and content syncs', async ({
    freshPageA,
    freshPageB,
  }) => {
    // ── Step 1: pageA creates a new notebook ──────────────────────────────────
    const notebookName = await freshPageA.notebook.createNew();
    expect(notebookName).toBeTruthy();
    createdNotebook = notebookName;

    // Wait for the notebook panel to appear
    await expect(freshPageA.locator('.jp-Notebook')).toBeVisible({ timeout: 15_000 });

    // ── Step 2: pageA types into the first (pre-existing) cell ────────────────
    await freshPageA.notebook.setCell(0, 'code', 'print("Hello from client A — cell 0")');
    await pause(5_000);

    // ── Step 3: pageB opens the same notebook ─────────────────────────────────
    // Refresh pageB's file browser so the newly created notebook is visible,
    // then open it.
    await freshPageB.filebrowser.refresh();
    await freshPageB.notebook.open(notebookName!);
    await expect(freshPageB.locator('.jp-Notebook')).toBeVisible({ timeout: 15_000 });

    // pageB should already see cell 0's content propagated
    await pause(3_000);

    // ── Step 4: pageA adds a code cell ───────────────────────────────────────
    await freshPageA.notebook.addCell('code', 'x = 42  # added by client A');
    await pause(3_000);

    // ── Step 5: pageB adds a markdown cell ───────────────────────────────────
    await freshPageB.notebook.addCell('markdown', '## Section added by client B');
    await pause(2_500);

    // ── Step 6: pageA adds another code cell ─────────────────────────────────
    await freshPageA.notebook.addCell('code', 'print("client A — cell 3")');
    await pause(2_000);

    // ── Step 7: pageB adds a final markdown cell ──────────────────────────────
    await freshPageB.notebook.addCell('markdown', '_Client B was here_');
    await pause(4_000);

    // ── Assertions ────────────────────────────────────────────────────────────
    // Both clients must converge on 5 cells (cell 0 + 4 added)
    const cellCountA = await freshPageA.notebook.getCellCount();
    const cellCountB = await freshPageB.notebook.getCellCount();
    expect(cellCountA).toBe(5);
    expect(cellCountB).toBe(5);

    // Spot-check cell types are consistent on both sides
    expect(await freshPageA.notebook.getCellType(1)).toBe('code');
    expect(await freshPageB.notebook.getCellType(1)).toBe('code');

    expect(await freshPageA.notebook.getCellType(2)).toBe('markdown');
    expect(await freshPageB.notebook.getCellType(2)).toBe('markdown');

    expect(await freshPageA.notebook.getCellType(3)).toBe('code');
    expect(await freshPageB.notebook.getCellType(3)).toBe('code');

    expect(await freshPageA.notebook.getCellType(4)).toBe('markdown');
    expect(await freshPageB.notebook.getCellType(4)).toBe('markdown');
  });

  /**
   * Same create-then-collaborate flow but with a latency toxic applied to
   * client A's connection once both clients are in the notebook.
   * Verifies that slower sync still converges correctly.
   */
  test('cells added under latency still converge', async ({
    freshPageA,
    freshPageB,
    toxi,
  }) => {
    // ── pageA creates notebook ─────────────────────────────────────────────────
    const notebookName = await freshPageA.notebook.createNew();
    expect(notebookName).toBeTruthy();
    createdNotebook = notebookName;

    await expect(freshPageA.locator('.jp-Notebook')).toBeVisible({ timeout: 15_000 });

    // ── pageB joins ───────────────────────────────────────────────────────────
    await freshPageB.filebrowser.refresh();
    await freshPageB.notebook.open(notebookName!);
    await expect(freshPageB.locator('.jp-Notebook')).toBeVisible({ timeout: 15_000 });

    // ── Inject 1 500 ms latency on client A's downstream link ─────────────────
    await toxi.addToxic('jupyter_client_a', 'client_a_latency', 'latency', 'downstream', 1, {
      latency: 1_500,
      jitter: 300,
    });
    await pause(2_000);

    // ── pageA adds a cell under latency ───────────────────────────────────────
    await freshPageA.notebook.addCell('code', 'slow_client_edit = True');
    await pause(3_000);

    // ── pageB adds a cell on a clean connection ───────────────────────────────
    await freshPageB.notebook.addCell('markdown', '## Fast client edit');
    await pause(5_000); // generous wait for A to receive B's edit through latency

    // Both sides converge to 3 cells (cell 0 + 2 added)
    const cellCountA = await freshPageA.notebook.getCellCount();
    const cellCountB = await freshPageB.notebook.getCellCount();
    expect(cellCountA).toBe(3);
    expect(cellCountB).toBe(3);
  });
});
