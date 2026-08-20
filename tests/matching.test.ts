import { describe, expect, it } from 'vitest';
import { applyWildcardValues, fits, getWildcardValues, wildcardToRegExp } from '../src/shared/matching';

describe('fits', () => {
  it('matches wildcard hosts', () => {
    expect(fits('https://edit.amazon.com/contact', 'https://*.amazon.com/contact', 'full')).toBe(true);
  });

  it('rejects wildcard host mismatch', () => {
    expect(fits('https://edit.amazon.com/cart', 'https://*.amazon.com/contact', 'full')).toBe(false);
  });

  it('matches wildcard paths', () => {
    expect(fits('https://a.com/user/123/edit', 'https://a.com/user/*/edit', 'full')).toBe(true);
  });

  it('matches multiple wildcards', () => {
    expect(fits('https://dev.example.com/user/456', 'https://*.example.com/user/*', 'full')).toBe(true);
  });

  it('applies wildcards before the filter', () => {
    expect(fits('https://dev.example.com/x', 'https://*.example.com/x', 'domain')).toBe(true);
  });

  it('does not match partially', () => {
    expect(fits('https://evil-amazon.com/contact', 'https://*.amazon.com/contact', 'full')).toBe(false);
  });

  it('supports the global * url', () => {
    expect(fits('https://anywhere.com/x', '*', 'full')).toBe(true);
  });

  it('domain filter compares hosts', () => {
    expect(fits('https://a.com/x', 'https://a.com/y', 'domain')).toBe(true);
    expect(fits('https://b.com/x', 'https://a.com/y', 'domain')).toBe(false);
  });

  it('full filter compares exact lowercased urls', () => {
    expect(fits('https://a.com/x', 'https://a.com/x', 'full')).toBe(true);
    expect(fits('https://a.com/x?a=1', 'https://a.com/x?a=2', 'full')).toBe(false);
  });

  it('path filter ignores query and anchor', () => {
    expect(fits('https://a.com/x?q=1#z', 'https://a.com/x?q=2', 'path')).toBe(true);
    expect(fits('https://a.com/x', 'https://a.com/y', 'path')).toBe(false);
  });

  it('unknown filter matches everything', () => {
    expect(fits('https://a.com/x', 'https://a.com/x', undefined)).toBe(true);
  });

  it('missing urls never match', () => {
    expect(fits(undefined, 'https://a.com/x', 'full')).toBe(false);
    expect(fits('https://a.com/x', undefined, 'full')).toBe(false);
    expect(fits('', 'https://a.com/x', 'full')).toBe(false);
  });

  it('malformed urls never match', () => {
    expect(fits('not a url', 'https://a.com/x', 'full')).toBe(false);
    expect(fits('https://a.com/x', '::::', 'full')).toBe(false);
  });
});

describe('wildcard values', () => {
  it('captures wildcard groups', () => {
    expect(getWildcardValues('https://dev.example.com/user/456', 'https://*.example.com/user/*')).toEqual(['dev', '456']);
  });

  it('returns null without wildcards or match', () => {
    expect(getWildcardValues('https://a.com/x', 'https://a.com/x')).toBeNull();
    expect(getWildcardValues('https://a.com/x', '*')).toBeNull();
    expect(getWildcardValues('https://a.com/y', 'https://a.com/x/*')).toBeNull();
    expect(getWildcardValues('https://a.com/x', undefined)).toBeNull();
  });

  it('applies captured values to {n} placeholders', () => {
    const content = { name: '{2}', host: '{1}', plain: 'hello' };
    applyWildcardValues(content, 'https://dev.example.com/user/456', 'https://*.example.com/user/*');
    expect(content).toEqual({ name: '456', host: 'dev', plain: 'hello' });
  });

  it('leaves unresolvable placeholders untouched', () => {
    const content = { a: '{0}', b: '{3}', c: 'x{2}y' };
    applyWildcardValues(content, 'https://dev.example.com/user/456', 'https://*.example.com/user/*');
    expect(content).toEqual({ a: '{0}', b: '{3}', c: 'x456y' });
  });

  it('does not touch content without wildcards', () => {
    const content = { name: '{1}' };
    applyWildcardValues(content, 'https://a.com/x', 'https://a.com/x');
    expect(content).toEqual({ name: '{1}' });
  });
});

describe('wildcardToRegExp', () => {
  it('escapes regex special characters', () => {
    const re = wildcardToRegExp('https://a.com/*?x=*');
    expect(re.test('https://a.com/v?x=1')).toBe(true);
    expect(re.test('https://a.com/vx=1')).toBe(false); // '?' is literal
    expect(re.test('https://aXcom/v?x=1')).toBe(false); // '.' is literal
  });
});
