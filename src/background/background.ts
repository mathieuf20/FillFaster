import browser from 'webextension-polyfill';
import { getAiConfig, type AiConfig } from '../shared/storage';
import { isLocalEndpoint } from '../shared/ai';
import { callChatCompletions } from './ai';
import type { AiFieldItem, AiFillResponse } from '../shared/ai';

const NOT_CONFIGURED = 'AI fill is not configured. Open the FillFaster popup, gear menu -> "AI fill settings..." and set an endpoint (and API key, unless it is a local endpoint).';

function hasValidConfig(config: AiConfig | null): config is AiConfig {
  if (!config || !config.model) {
    return false;
  }
  return isLocalEndpoint(config.endpoint) || config.apiKey.length > 0;
}

async function handleAiFill(items: AiFieldItem[]): Promise<AiFillResponse> {
  const config = await getAiConfig();
  if (!hasValidConfig(config)) {
    return { error: true, message: NOT_CONFIGURED };
  }

  try {
    const values: Record<string, string> = {};
    const results = await Promise.all(
      items.map(async (item): Promise<readonly [string, string]> => [item.name, await callChatCompletions(config, item)]),
    );
    for (const [name, value] of results) {
      values[name] = value;
    }
    return { values };
  } catch (e) {
    return { error: true, message: (e as Error).message };
  }
}

async function handleAiTest(): Promise<AiFillResponse> {
  const config = await getAiConfig();
  if (!hasValidConfig(config)) {
    return { error: true, message: NOT_CONFIGURED };
  }
  try {
    const value = await callChatCompletions(config, { name: 'test', instruction: 'Reply with exactly: ok' });
    return { values: { test: value } };
  } catch (e) {
    return { error: true, message: (e as Error).message };
  }
}

browser.runtime.onMessage.addListener((request: unknown, _sender: unknown): Promise<unknown> | undefined => {
  const message = (request ?? {}) as { action?: string; items?: AiFieldItem[] };

  switch (message.action) {
    case 'aiFill':
      return handleAiFill(message.items ?? []);
    case 'aiTest':
      return handleAiTest();
    default:
      return undefined;
  }
});
