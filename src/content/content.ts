import browser from 'webextension-polyfill';
import { fits, applyWildcardValues } from '../shared/matching';
import { hotkeyMatches, parseHotkey, type HotkeyCombo } from '../shared/hotkeys';
import { loadAll } from '../shared/storage';
import { collectAiRequests, type AiFieldItem, type AiFillResponse } from '../shared/ai';
import type { FillResponse, FormContent, SetSettings, StoreResponse } from '../shared/types';
import { fillForm, serializeForm } from './form-io';

interface HotkeyBinding {
  combo: HotkeyCombo;
  spec: string;
}

let bindings: HotkeyBinding[] = [];

function fieldContext(name: string): { type?: string; label?: string; placeholder?: string } {
  const escaped = CSS.escape(name);
  const el = document.querySelector<HTMLElement>('[id="' + escaped + '"], [name="' + escaped + '"]');
  if (!el) {
    return {};
  }
  const labelEl =
    el.closest('label') ?? document.querySelector<HTMLElement>('label[for="' + escaped + '"]');
  return {
    type: el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase(),
    label: labelEl?.textContent?.trim() || undefined,
    placeholder: el.getAttribute('placeholder') ?? undefined,
  };
}

async function resolveAiPlaceholders(content: FormContent): Promise<void> {
  const requests = collectAiRequests(content);
  if (requests.length === 0) {
    return;
  }
  const items: AiFieldItem[] = requests.map((request) => ({ ...request, ...fieldContext(request.name) }));
  try {
    const response = (await browser.runtime.sendMessage({ action: 'aiFill', items })) as AiFillResponse;
    if (response.error || !response.values) {
      throw new Error(response.message ?? 'AI fill failed');
    }
    for (const [name, value] of Object.entries(response.values)) {
      content[name] = value;
    }
  } catch (e) {
    alert('AI fill failed: ' + (e as Error).message);
    console.warn('FillFaster AI fill failed', e);
  }
}

async function fill(set: SetSettings): Promise<FillResponse> {
  const { prefix } = await loadAll();
  const content = JSON.parse(set.content) as FormContent;

  // Replace {1}, {2}, ... placeholders with values captured from the current URL.
  applyWildcardValues(content, location.href, set.url);

  // Replace @@@AI@@@ placeholders with generated values.
  await resolveAiPlaceholders(content);

  fillForm(document.body, content, { prefix });

  if (set.autoSubmit) {
    if (!set.submitQuery) {
      alert('Submit button query returned no results');
    } else {
      try {
        const submitButton = document.querySelector<HTMLElement>(set.submitQuery);
        if (submitButton) {
          submitButton.click();
        } else {
          alert('Submit button query returned no results');
        }
      } catch (e) {
        alert('Error in submit query: ' + (e as Error).message);
      }
    }
  }

  return {};
}

async function bindHotkeys(): Promise<void> {
  const { sets, filter } = await loadAll();
  const next: HotkeyBinding[] = [];
  for (const set of Object.values(sets)) {
    if (!set.hotkey || !fits(location.href, set.url, filter)) {
      continue;
    }
    const combo = parseHotkey(set.hotkey);
    if (combo) {
      next.push({ combo, spec: set.hotkey });
    }
  }
  bindings = next;
}

function onKeydown(e: KeyboardEvent): void {
  if (!bindings.some((binding) => hotkeyMatches(binding.combo, e))) {
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  void (async () => {
    // Re-read storage on trigger so deletes/edits are honored immediately.
    const { sets, filter } = await loadAll();
    for (const set of Object.values(sets)) {
      if (!set.hotkey || !fits(location.href, set.url, filter)) {
        continue;
      }
      const combo = parseHotkey(set.hotkey);
      if (combo && hotkeyMatches(combo, e)) {
        await fill(set);
        return;
      }
    }
    alert('Hotkey not found');
  })();
}

browser.runtime.onMessage.addListener((request: unknown, _sender: unknown): Promise<unknown> | undefined => {
  const message = (request ?? {}) as { action?: string; setSettings?: SetSettings };

  switch (message.action) {
    case 'store': {
      try {
        const response: StoreResponse = { content: JSON.stringify(serializeForm(document.body)) };
        return Promise.resolve(response);
      } catch (e) {
        const response: StoreResponse = { content: '', error: true, message: (e as Error).message };
        return Promise.resolve(response);
      }
    }

    case 'fill': {
      const set = message.setSettings;
      if (!set || !set.content) {
        return Promise.resolve({ error: true, message: 'No saved set to fill' } satisfies FillResponse);
      }
      return fill(set).catch((e: unknown) => ({ error: true, message: (e as Error).message }) satisfies FillResponse);
    }

    case 'rebind':
      return bindHotkeys().then(
        () => ({}),
        (e: unknown) => ({ error: true, message: (e as Error).message }) satisfies FillResponse,
      );

    default:
      return undefined;
  }
});

document.addEventListener('keydown', onKeydown, true);
void bindHotkeys();
