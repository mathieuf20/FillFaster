import { beforeEach, describe, expect, it } from 'vitest';
import {
  getAiConfig,
  isSetSettings,
  migratePrefixInSets,
  saveAiConfig,
  savePrefixWithMigration,
  saveSet,
  splitStorage,
} from '../src/shared/storage';
import type { SetSettings } from '../src/shared/types';

declare global {
  // Provided by tests/setup.ts
  var __fasrResetStorage: () => void;
  var __fasrStorage: () => Record<string, unknown>;
}

const set = (name: string): SetSettings => ({
  name,
  url: 'https://a.com/x',
  autoSubmit: false,
  submitQuery: '',
  content: JSON.stringify({ a: '1' }),
  hotkey: '',
});

beforeEach(() => {
  __fasrResetStorage();
});

describe('splitStorage', () => {
  it('splits sets, filter and prefix', () => {
    const loaded = splitStorage({
      s1: set('one'),
      filter: 'domain',
      prefix: '[[P]]',
    });
    expect(Object.keys(loaded.sets)).toEqual(['s1']);
    expect(loaded.filter).toBe('domain');
    expect(loaded.prefix).toBe('[[P]]');
  });

  it('drops junk, invalid filters and the ai config key', () => {
    const loaded = splitStorage({
      junk: 'not-an-object',
      aiConfig: { endpoint: 'x', apiKey: 'y', model: 'z' },
      filter: 'bogus',
      prefix: '',
    });
    expect(loaded.sets).toEqual({});
    expect(loaded.filter).toBeUndefined();
    expect(loaded.prefix).toBe('@@@DTPH@@@');
  });
});

describe('isSetSettings', () => {
  it('accepts complete sets and rejects everything else', () => {
    expect(isSetSettings(set('x'))).toBe(true);
    expect(isSetSettings({ name: 'x', url: 'u' })).toBe(false);
    expect(isSetSettings(null)).toBe(false);
    expect(isSetSettings('x')).toBe(false);
  });
});

describe('migratePrefixInSets', () => {
  it('rewrites the old prefix everywhere in content', () => {
    const sets = { a: set('a'), b: set('b') };
    sets.a!.content = JSON.stringify({ when: '@@@DTPH@@@%y' });
    sets.b!.content = JSON.stringify({ when: '@@@DTPH@@@%y', other: 'x' });
    migratePrefixInSets(sets, '@@@DTPH@@@', '[[P]]');
    expect(JSON.parse(sets.a!.content).when).toBe('[[P]]%y');
    expect(JSON.parse(sets.b!.content).when).toBe('[[P]]%y');
  });

  it('is a no-op when prefixes are equal', () => {
    const sets = { a: set('a') };
    sets.a!.content = JSON.stringify({ when: '@@@DTPH@@@%y' });
    migratePrefixInSets(sets, '[[P]]', '[[P]]');
    expect(JSON.parse(sets.a!.content).when).toBe('@@@DTPH@@@%y');
  });
});

describe('browser-backed storage', () => {
  it('saves and reads the ai config with defaults applied', async () => {
    expect(await getAiConfig()).toBeNull();

    await saveAiConfig({ endpoint: '', apiKey: 'k', model: '', defaultInstruction: 'x' });
    const config = await getAiConfig();
    expect(config?.apiKey).toBe('k');
    expect(config?.endpoint).toBe('https://api.openai.com/v1');
    expect(config?.model).toBe('gpt-4o-mini');
  });

  it('migrates prefixes across stored sets and persists the new prefix', async () => {
    const s = set('a');
    s.content = JSON.stringify({ when: '@@@DTPH@@@%y' });
    await saveSet('s1', s);

    await savePrefixWithMigration('[[P]]');

    const stored = __fasrStorage();
    expect(stored.prefix).toBe('[[P]]');
    expect(JSON.parse((stored.s1 as SetSettings).content).when).toBe('[[P]]%y');
  });
});
