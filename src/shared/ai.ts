import type { FormContent } from './types';

export const AI_PREFIX = '@@@AI@@@';
export const DEFAULT_AI_ENDPOINT = 'https://api.openai.com/v1';
export const DEFAULT_AI_MODEL = 'gpt-4o-mini';

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
