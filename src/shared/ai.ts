import type { FormContent } from './types';

export const AI_PREFIX = '@@@AI@@@';
export const DEFAULT_AI_ENDPOINT = 'https://api.openai.com/v1';
export const DEFAULT_AI_MODEL = 'gpt-4o-mini';

export interface AiEndpointPreset {
  id: string;
  label: string;
  endpoint: string;
  model: string;
}

/** Common OpenAI-compatible providers shown in the popup settings. */
export const AI_ENDPOINT_PRESETS: AiEndpointPreset[] = [
  { id: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'openrouter', label: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { id: 'groq', label: 'Groq', endpoint: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { id: 'mistral', label: 'Mistral', endpoint: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
  {
    id: 'anthropic',
    label: 'Anthropic (OpenAI-compatible)',
    endpoint: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-20250514',
  },
  {
    id: 'gemini',
    label: 'Google Gemini (OpenAI-compatible)',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
  },
  { id: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { id: 'ollama', label: 'Ollama (local)', endpoint: 'http://localhost:11434/v1', model: 'llama3.2' },
  { id: 'lmstudio', label: 'LM Studio (local)', endpoint: 'http://localhost:1234/v1', model: '' },
];

/** The preset matching an endpoint exactly, or null. */
export function presetForEndpoint(endpoint: string): AiEndpointPreset | null {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  return AI_ENDPOINT_PRESETS.find((preset) => preset.endpoint === trimmed) ?? null;
}

export function isLocalEndpoint(endpoint: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/.test(endpoint.trim());
}
export interface AiFieldRequest {
  /** Form field key (id or name). */
  name: string;
  /** User instruction, may be empty. */
  instruction: string;
}

export interface AiFieldItem extends AiFieldRequest {
  type?: string;
  label?: string;
  placeholder?: string;
}

export interface AiFillResponse {
  values?: Record<string, string>;
  error?: boolean;
  message?: string;
}

/**
 * Returns the instruction for a field value starting with the AI prefix,
 * or null when the value is not an AI placeholder. The text after the
 * prefix is the per-field instruction.
 */
export function parseAiValue(value: string): { instruction: string } | null {
  if (!value.startsWith(AI_PREFIX)) {
    return null;
  }
  return { instruction: value.slice(AI_PREFIX.length).trim() };
}

/** Collects the AI placeholder requests from a captured form. */
export function collectAiRequests(content: FormContent): AiFieldRequest[] {
  const requests: AiFieldRequest[] = [];
  for (const [name, value] of Object.entries(content)) {
    if (typeof value !== 'string') {
      continue;
    }
    const parsed = parseAiValue(value);
    if (parsed) {
      requests.push({ name, instruction: parsed.instruction });
    }
  }
  return requests;
}

const SYSTEM_PROMPT =
  'You are filling in a web form for a software tester. ' +
  'Reply with only the raw value to put in the field: no quotes, no explanation, no extra text.';

/** Builds the chat messages describing one field to fill. */
export function buildAiMessages(item: AiFieldItem, defaultInstruction: string): Array<{ role: 'system' | 'user'; content: string }> {
  const lines: string[] = [];
  lines.push('Field name: ' + item.name);
  if (item.label) {
    lines.push('Field label: ' + item.label);
  }
  if (item.placeholder) {
    lines.push('Field placeholder: ' + item.placeholder);
  }
  if (item.type) {
    lines.push('Input type: ' + item.type);
  }
  const instruction = item.instruction || defaultInstruction;
  lines.push(instruction ? 'Instruction: ' + instruction : 'Instruction: generate a realistic value that fits this field.');

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ];
}
