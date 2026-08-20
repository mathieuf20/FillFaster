import { describe, expect, it } from 'vitest';
import { replaceDateTimePlaceholders, shouldTransform } from '../src/shared/datetime';

const NOW = new Date(2020, 0, 5, 6, 7, 8); // 2020-01-05 06:07:08

describe('replaceDateTimePlaceholders', () => {
  it('strips the prefix and fills every token', () => {
    const value = '@@@DTPH@@@%y-%m-%d %H:%M:%S';
    expect(replaceDateTimePlaceholders(value, '@@@DTPH@@@', NOW)).toBe('2020-01-05 06:07:08');
  });

  it('supports custom prefixes', () => {
    expect(replaceDateTimePlaceholders('[[P]]%d/%m', '[[P]]', NOW)).toBe('05/01');
  });

  it('keeps literal % via %%', () => {
    expect(replaceDateTimePlaceholders('@@@DTPH@@@100%% done', '@@@DTPH@@@', NOW)).toBe('100% done');
  });

  it('works with an empty format after the prefix', () => {
    expect(replaceDateTimePlaceholders('@@@DTPH@@@', '@@@DTPH@@@', NOW)).toBe('');
  });
});

describe('shouldTransform', () => {
  it('requires a non-empty prefix', () => {
    expect(shouldTransform('@@@DTPH@@@%y', '@@@DTPH@@@')).toBe(true);
    expect(shouldTransform('x@@@DTPH@@@%y', '@@@DTPH@@@')).toBe(false);
    expect(shouldTransform('anything', '')).toBe(false);
  });
});
