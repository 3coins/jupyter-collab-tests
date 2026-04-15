import { test, expect } from '../chat-fixtures';
import {
  createAndOpenChat,
  openChat,
  mentionAgent,
  waitForAgentResponse,
  getMessageCount,
  getMessageTexts,
  closeChat,
  CHAT_RENDERED_MESSAGE,
} from '../chat-helpers';

const FILENAME = 'test-drain.chat';

// inactivity_timeout=10s + auto_free_interval=60s + 5s margin
const DRAIN_WAIT_MS = 120_000;

test.describe('chat yroom drain', () => {
  test.afterEach(async ({ chatPage }) => {
    try {
      if (await chatPage.filebrowser.contents.fileExists(FILENAME)) {
        await chatPage.filebrowser.contents.deleteFile(FILENAME);
      }
    } catch { /* best-effort cleanup */ }
  });

  test('should preserve history after yroom drain', async ({ chatPage }) => {
    test.setTimeout(180_000);

    // ── Create chat and exchange messages ─────────────────────────────────────
    const chatPanel = await createAndOpenChat(chatPage, FILENAME);
    await mentionAgent(chatPage, chatPanel, 'Claude', 'hello');
    const userCount = await getMessageCount(chatPanel);
    await waitForAgentResponse(chatPanel, userCount);

    const messageCount = await getMessageCount(chatPanel);
    const messageTexts = await getMessageTexts(chatPanel);
    expect(messageCount).toBeGreaterThanOrEqual(2);

    // ── Close the chat tab ────────────────────────────────────────────────────
    await closeChat(chatPage, FILENAME);

    // ── Wait for yroom to drain ───────────────────────────────────────────────
    console.log(`Waiting ${DRAIN_WAIT_MS / 1000}s for yroom to drain...`);
    await chatPage.waitForTimeout(DRAIN_WAIT_MS);

    // ── Reopen the chat and verify history ────────────────────────────────────
    const reopenedPanel = await openChat(chatPage, FILENAME);

    // Wait for messages to load from disk
    await expect(reopenedPanel.locator(CHAT_RENDERED_MESSAGE)).toHaveCount(
      messageCount,
      { timeout: 30_000 },
    );

    const restoredTexts = await getMessageTexts(reopenedPanel);
    expect(restoredTexts).toEqual(messageTexts);
  });
});
