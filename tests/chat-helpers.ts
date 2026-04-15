import { IJupyterLabPageFixture } from '@jupyterlab/galata';
import { Locator, expect } from '@playwright/test';

// ── Selectors ────────────────────────────────────────────────────────────────
export const CHAT_INPUT = '.jp-chat-input-container [role="combobox"]';
export const CHAT_SEND_BUTTON = '.jp-chat-input-container .jp-chat-send-button';
export const CHAT_MESSAGE = '.jp-chat-message';
export const CHAT_RENDERED_MESSAGE = '.jp-chat-rendered-message';
export const CHAT_COMMAND_NAME = '.jp-chat-command-name';

// ── Helpers ──────────────────────────────────────────────────────────────────

export async function createAndOpenChat(
  page: IJupyterLabPageFixture,
  filename: string,
): Promise<Locator> {
  await page.evaluate(async (name: string) => {
    await window.jupyterapp.commands.execute('jupyterlab-chat:create', { name });
  }, filename);

  await page.evaluate(async (filepath: string) => {
    await window.jupyterapp.commands.execute('jupyterlab-chat:open', { filepath });
  }, filename);

  await page.waitForCondition(
    async () => await page.activity.isTabActive(filename),
  );

  return (await page.activity.getPanelLocator(filename))!;
}

export async function openChat(
  page: IJupyterLabPageFixture,
  filename: string,
): Promise<Locator> {
  await page.evaluate(async (filepath: string) => {
    await window.jupyterapp.commands.execute('jupyterlab-chat:open', { filepath });
  }, filename);

  await page.waitForCondition(
    async () => await page.activity.isTabActive(filename),
  );

  return (await page.activity.getPanelLocator(filename))!;
}

export async function sendMessage(
  chatPanel: Locator,
  text: string,
): Promise<void> {
  const input = chatPanel.locator(CHAT_INPUT);
  await input.pressSequentially(text);
  await chatPanel.locator(CHAT_SEND_BUTTON).click();
}

export async function mentionAgent(
  page: IJupyterLabPageFixture,
  chatPanel: Locator,
  agentName: string,
  messageText: string,
): Promise<void> {
  const input = chatPanel.locator(CHAT_INPUT);
  // Wait for personas to register and for auth polling to complete.
  // The Kiro persona polls `kiro-cli whoami` every 2s; 10s gives enough
  // time for registration + at least one successful auth check cycle.
  await chatPanel.page().waitForTimeout(10_000);
  await input.pressSequentially('@');

  // Wait for the autocomplete dropdown to show the agent
  const commandItem = page.locator(CHAT_COMMAND_NAME).filter({ hasText: `@${agentName}` });
  await expect(commandItem.first()).toBeVisible({ timeout: 120_000 });
  await commandItem.first().click();

  // Type the rest of the message and send
  await input.pressSequentially(` ${messageText}`);
  await chatPanel.locator(CHAT_SEND_BUTTON).click();
}

export async function waitForAgentResponse(
  chatPanel: Locator,
  previousCount: number,
  timeout = 90_000,
): Promise<number> {
  const messages = chatPanel.locator(CHAT_MESSAGE);
  await expect(messages).not.toHaveCount(previousCount, { timeout });
  return await messages.count();
}

export async function getMessageCount(chatPanel: Locator): Promise<number> {
  return await chatPanel.locator(CHAT_MESSAGE).count();
}

export async function getMessageTexts(chatPanel: Locator): Promise<string[]> {
  return await chatPanel.locator(CHAT_RENDERED_MESSAGE).allTextContents();
}

export async function closeChat(
  page: IJupyterLabPageFixture,
  filename: string,
): Promise<void> {
  await page.activity.closeAll();
}
