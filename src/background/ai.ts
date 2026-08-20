import type { AiConfig } from '../shared/storage';
import { buildAiMessages, type AiFieldItem } from '../shared/ai';

/**
 * Builds the endpoint URL. Accepts a base URL (e.g. https://api.openai.com/v1)
 * or a full /chat/completions URL.
 */
export function chatCompletionsUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  return trimmed + '/chat/completions';
}

export async function callChatCompletions(
  config: AiConfig,
  item: AiFieldItem,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(chatCompletionsUrl(config.endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + config.apiKey,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.7,
      messages: buildAiMessages(item, config.defaultInstruction),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error('AI endpoint returned ' + response.status + (body ? ': ' + body.slice(0, 200) : ''));
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('AI endpoint returned an empty response');
  }
  return content.trim();
}
