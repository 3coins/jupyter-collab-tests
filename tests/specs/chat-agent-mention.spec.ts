import { test, expect } from '../chat-fixtures';
import {
  createAndOpenChat,
  mentionAgent,
  waitForAgentResponse,
  getMessageCount,
  getMessageTexts,
  CHAT_MESSAGE,
} from '../chat-helpers';

const FILENAME = 'test-mention.chat';

test.describe('chat agent @mention', () => {
  test.afterEach(async ({ chatPage }) => {
    try {
      if (await chatPage.filebrowser.contents.fileExists(FILENAME)) {
        await chatPage.filebrowser.contents.deleteFile(FILENAME);
      }
    } catch { /* best-effort cleanup */ }
  });

  test('should get a response when mentioning @Kiro', async ({ chatPage }) => {
    const chatPanel = await createAndOpenChat(chatPage, FILENAME);
    expect(await getMessageCount(chatPanel)).toBe(0);

    await mentionAgent(chatPage, chatPanel, 'Kiro', 'hello');

    // User message should appear
    await expect(chatPanel.locator(CHAT_MESSAGE)).not.toHaveCount(0, { timeout: 10_000 });

    // Wait for agent response
    const userCount = await getMessageCount(chatPanel);
    await waitForAgentResponse(chatPanel, userCount);

    // Verify response is non-empty
    const texts = await getMessageTexts(chatPanel);
    expect(texts.length).toBeGreaterThanOrEqual(2);
    expect(texts[texts.length - 1].trim()).not.toBe('');
  });
});
