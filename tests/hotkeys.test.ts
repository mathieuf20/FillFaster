import { describe, expect, it } from 'vitest';
import { hotkeyMatches, parseHotkey } from '../src/shared/hotkeys';

const ev = (key: string, mods: Partial<{ ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }> = {}) => ({
  key,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

describe('parseHotkey', () => {
  it('parses single keys', () => {
    expect(parseHotkey('k')).toEqual({ ctrl: false, alt: false, shift: false, meta: false, key: 'k' });
    expect(parseHotkey('esc')).toEqual({ ctrl: false, alt: false, shift: false, meta: false, key: 'escape' });
  });

  it('parses modifier combos and aliases', () => {
    expect(parseHotkey('ctrl+shift+f')?.key).toBe('f');
    expect(parseHotkey('CTRL+SHIFT+F')?.ctrl).toBe(true);
    expect(parseHotkey('option+x')?.alt).toBe(true);
    expect(parseHotkey('command+enter')?.meta).toBe(true);
    expect(parseHotkey('command+enter')?.key).toBe('enter');
  });

  it('canonicalizes key aliases', () => {
    expect(parseHotkey('return')?.key).toBe('enter');
    expect(parseHotkey('del')?.key).toBe('delete');
    expect(parseHotkey('space')?.key).toBe('space');
  });

  it('rejects malformed combos', () => {
    expect(parseHotkey('')).toBeNull();
    expect(parseHotkey('ctrl+')).toBeNull();
    expect(parseHotkey('a+b')).toBeNull();
    expect(parseHotkey('unknown')).toBeNull();
  });
});

describe('hotkeyMatches', () => {
  it('matches letter with shift', () => {
    const combo = parseHotkey('shift+k')!;
    expect(hotkeyMatches(combo, ev('K', { shiftKey: true }))).toBe(true);
    expect(hotkeyMatches(combo, ev('k'))).toBe(false);
  });

  it('matches special keys', () => {
    const combo = parseHotkey('ctrl+esc')!;
    expect(hotkeyMatches(combo, ev('Escape', { ctrlKey: true }))).toBe(true);
  });

  it('requires exact modifiers', () => {
    const combo = parseHotkey('ctrl+alt+enter')!;
    expect(hotkeyMatches(combo, ev('Enter', { ctrlKey: true, altKey: true }))).toBe(true);
    expect(hotkeyMatches(combo, ev('Enter', { ctrlKey: true, altKey: true, shiftKey: true }))).toBe(false);
  });

  it('matches punctuation keys', () => {
    const combo = parseHotkey('=')!;
    expect(hotkeyMatches(combo, ev('='))).toBe(true);
  });
});
