import { replaceDateTimePlaceholders, shouldTransform } from '../shared/datetime';
import type { FormContent } from '../shared/types';

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const EXCLUDED_SELECTOR = 'button, input[type=image], input[type=submit], input[type=hidden], input[type=button]';

const TEXT_TYPES = new Set(['text', 'email', 'search', 'url', 'date']);
const RAW_TYPES = new Set(['password', 'number', 'tel']);

function formControls(root: HTMLElement): FormControl[] {
  const all = root.querySelectorAll<HTMLElement>('input, select, textarea, button');
  return [...all].filter((el) => !el.matches(EXCLUDED_SELECTOR)) as FormControl[];
}

function controlName(el: FormControl): string {
  return el.id || el.getAttribute('name') || '';
}

function trigger(el: Element, type: string): void {
  el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
}

/**
 * Captures every visible form value in root. Semantics match the original
 * FormAssistant implementation: id wins over name, ASP.NET __* fields are
 * skipped, radio stores the checked value, checkbox stores "true"/"false",
 * repeated names are joined with ",".
 */
export function serializeForm(root: HTMLElement): FormContent {
  const params: FormContent = {};

  for (const el of formControls(root)) {
    if (!el.id && !el.getAttribute('name')) {
      console.error('Filler error: an input does not have id or name attribute. Skipping');
      continue;
    }

    const name = controlName(el);
    const value = el.value;
    if (!value) {
      continue;
    }

    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      params[name] = el.checked ? 'true' : 'false';
      continue;
    }
    if (el instanceof HTMLInputElement && el.type === 'radio') {
      if (el.checked) {
        params[name] = value;
      }
      continue;
    }

    if (!name || /__.+/ .test(name)) {
      continue;
    }
    params[name] = params[name] === undefined ? value : params[name] + ',' + value;
  }

  return params;
}

export interface FillOptions {
  prefix?: string;
  /** Injectable clock for tests. */
  now?: Date;
}

/**
 * Fills every form control in root from content. Placeholder-prefixed values
 * are expanded; native input/change/blur events are dispatched so reactive
 * frameworks notice the fill.
 */
export function fillForm(root: HTMLElement, content: FormContent, options: FillOptions = {}): void {
  const prefix = options.prefix ?? '';
  const now = options.now ?? new Date();

  for (const el of formControls(root)) {
    if (!el.id && !el.getAttribute('name')) {
      continue;
    }

    const name = controlName(el);
    const saved = content[name];

    if (el.disabled) {
      continue;
    }

    if (el instanceof HTMLTextAreaElement) {
      if (saved === undefined) {
        console.warn('Value for ' + name + ' not found');
      } else {
        el.value = shouldTransform(saved, prefix) ? replaceDateTimePlaceholders(saved, prefix, now) : saved;
      }
      trigger(el, 'change');
      trigger(el, 'blur');
      continue;
    }

    if (el instanceof HTMLSelectElement) {
      if (saved !== undefined) {
        el.value = saved;
        trigger(el, 'change');
        trigger(el, 'blur');
      }
      continue;
    }

    if (el instanceof HTMLInputElement && el.type === 'radio') {
      if (saved !== undefined && el.value === saved) {
        el.checked = true;
        el.click();
      }
      continue;
    }

    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (saved !== undefined) {
        el.checked = el.value === saved || saved === 'true';
        trigger(el, 'change');
        trigger(el, 'blur');
      }
      continue;
    }

    if (el instanceof HTMLInputElement && (TEXT_TYPES.has(el.type) || RAW_TYPES.has(el.type))) {
      if (saved === undefined) {
        console.warn('Value for ' + name + ' not found');
      } else if (TEXT_TYPES.has(el.type) && shouldTransform(saved, prefix)) {
        el.value = replaceDateTimePlaceholders(saved, prefix, now);
      } else {
        el.value = saved;
      }
      trigger(el, 'input');
      trigger(el, 'change');
      trigger(el, 'blur');
    }
  }
}
