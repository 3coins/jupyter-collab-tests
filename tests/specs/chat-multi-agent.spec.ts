import { test, expect } from '../chat-fixtures';
import {
  createAndOpenChat,
  mentionAgent,
  waitForAgentResponse,
  getMessageCount,
} from '../chat-helpers';

const FILENAME = 'test-multi-agent.chat';

test.describe('chat multi-agent', () => {
  test.afterEach(async ({ chatPage }) => {
    try {
      if (await chatPage.filebrowser.contents.fileExists(FILENAME)) {
        await chatPage.filebrowser.contents.deleteFile(FILENAME);
      }
    } catch { /* best-effort cleanup */ }
  });

  test('should get responses from Claude, and Codex', async ({ chatPage }) => {
    test.setTimeout(300_000);

    const chatPanel = await createAndOpenChat(chatPage, FILENAME);

    // ── @Claude ───────────────────────────────────────────────────────────────
    await mentionAgent(chatPage, chatPanel, 'Claude', 'hello');
    let count = await getMessageCount(chatPanel);
    count = await waitForAgentResponse(chatPanel, count);

    // ── @Codex ────────────────────────────────────────────────────────────────
    await mentionAgent(chatPage, chatPanel, 'Codex', 'hello');
    count = await waitForAgentResponse(chatPanel, count);

    // 3 user messages + 3 agent responses = at least 6
    expect(await getMessageCount(chatPanel)).toBeGreaterThanOrEqual(6);
  });
});
