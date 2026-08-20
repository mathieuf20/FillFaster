import { describe, expect, it } from 'vitest';
import { buildAiMessages, collectAiRequests, parseAiValue } from '../src/shared/ai';
import { callChatCompletions, chatCompletionsUrl } from '../src/background/ai';
import type { AiConfig } from '../src/shared/storage';

const config: AiConfig = {
  endpoint: 'https://api.example.com/v1',
  apiKey: 'secret',
  model: 'test-model',
  defaultInstruction: '',
};

describe('parseAiValue', () => {
  it('detects AI placeholders and extracts instructions', () => {
    expect(parseAiValue('@@@AI@@@')).toEqual({ instruction: '' });
    expect(parseAiValue('@@@AI@@@ a Lebanese-sounding name')).toEqual({ instruction: 'a Lebanese-sounding name' });
    expect(parseAiValue('@@@DTPH@@@%y')).toBeNull();
    expect(parseAiValue('hello')).toBeNull();
  });
});

describe('collectAiRequests', () => {
  it('collects only AI placeholder values', () => {
    const content = { name: '@@@AI@@@ lebanese name', city: 'Paris', when: '@@@DTPH@@@%y' };
    expect(collectAiRequests(content)).toEqual([{ name: 'name', instruction: 'lebanese name' }]);
  });
});

describe('buildAiMessages', () => {
  it('includes field context and instruction', () => {
    const messages = buildAiMessages(
      { name: 'fname', instruction: 'lebanese', type: 'text', label: 'First name', placeholder: 'John' },
      'fallback',
    );
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('system');
    const user = messages[1]?.content ?? '';
    expect(user).toContain('Field name: fname');
    expect(user).toContain('Field label: First name');
    expect(user).toContain('Field placeholder: John');
    expect(user).toContain('Input type: text');
    expect(user).toContain('Instruction: lebanese');
  });

  it('falls back to the default instruction', () => {
    const messages = buildAiMessages({ name: 'fname', instruction: '' }, 'make it plausible');
    expect(messages[1]?.content).toContain('Instruction: make it plausible');
  });

  it('uses a generic instruction when nothing is provided', () => {
    const messages = buildAiMessages({ name: 'fname', instruction: '' }, '');
    expect(messages[1]?.content).toContain('Instruction: generate a realistic value that fits this field.');
  });
});

describe('chatCompletionsUrl', () => {
  it('appends chat/completions to base urls', () => {
    expect(chatCompletionsUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/chat/completions');
    expect(chatCompletionsUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1/chat/completions');
    expect(chatCompletionsUrl('http://localhost:11434/v1')).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('keeps full endpoints untouched', () => {
    expect(chatCompletionsUrl('https://api.openai.com/v1/chat/completions')).toBe('https://api.openai.com/v1/chat/completions');
  });
});

describe('callChatCompletions', () => {
  it('posts the right request and returns the content', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ choices: [{ message: { content: '  Elias  ' } }] }), { status: 200 });
    }) as typeof fetch;

    const value = await callChatCompletions(config, { name: 'fname', instruction: 'lebanese' }, fetchImpl);
    expect(value).toBe('Elias');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.example.com/v1/chat/completions');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(calls[0]?.init.body as string) as { model: string };
    expect(body.model).toBe('test-model');
  });

  it('throws on non-200 responses with the body', async () => {
    const fetchImpl = (async () => new Response('{"error":"bad key"}', { status: 401 })) as typeof fetch;
    await expect(callChatCompletions(config, { name: 'x', instruction: '' }, fetchImpl)).rejects.toThrow(/401/);
  });

  it('throws on empty completions', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })) as typeof fetch;
    await expect(callChatCompletions(config, { name: 'x', instruction: '' }, fetchImpl)).rejects.toThrow(/empty/);
  });
});
