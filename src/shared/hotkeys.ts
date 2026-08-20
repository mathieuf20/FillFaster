export interface HotkeyCombo {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

type ModifierName = 'ctrl' | 'alt' | 'shift' | 'meta';

const MODIFIER_ALIASES: Record<string, ModifierName> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  meta: 'meta',
  command: 'meta',
  cmd: 'meta',
  win: 'meta',
};

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  escape: 'escape',
  return: 'enter',
  enter: 'enter',
  space: 'space',
  backspace: 'backspace',
  tab: 'tab',
  capslock: 'capslock',
  pageup: 'pageup',
  pagedown: 'pagedown',
  end: 'end',
  home: 'home',
  left: 'left',
  right: 'right',
  up: 'up',
  down: 'down',
  ins: 'insert',
  insert: 'insert',
  del: 'delete',
  delete: 'delete',
};

const EVENT_KEY_ALIASES: Record<string, string> = {
  Escape: 'escape',
  Enter: 'enter',
  ' ': 'space',
  Backspace: 'backspace',
  Tab: 'tab',
  CapsLock: 'capslock',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  End: 'end',
  Home: 'home',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Insert: 'insert',
  Delete: 'delete',
};

/**
 * Parses a mousetrap-style combo string ('ctrl+shift+f', 'esc', ...).
 * Returns null for malformed combos.
 */
export function parseHotkey(spec: string): HotkeyCombo | null {
  const tokens = spec
    .trim()
    .toLowerCase()
    .split('+')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const combo: HotkeyCombo = { ctrl: false, alt: false, shift: false, meta: false, key: '' };
  for (const token of tokens) {
    const modifier = MODIFIER_ALIASES[token];
    if (modifier !== undefined) {
      combo[modifier] = true;
      continue;
    }
    const key = KEY_ALIASES[token] ?? (token.length === 1 ? token : null);
    if (key === null || combo.key !== '') {
      return null;
    }
    combo.key = key;
  }
  return combo.key === '' ? null : combo;
}

function eventKey(e: KeyEventLike): string {
  return EVENT_KEY_ALIASES[e.key] ?? e.key.toLowerCase();
}

export function hotkeyMatches(combo: HotkeyCombo, e: KeyEventLike): boolean {
  return (
    combo.ctrl === e.ctrlKey &&
    combo.alt === e.altKey &&
    combo.shift === e.shiftKey &&
    combo.meta === e.metaKey &&
    combo.key === eventKey(e)
  );
}
