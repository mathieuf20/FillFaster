import type { Filter, FormContent } from './types';

export const FILTERS: Filter[] = ['domain', 'path', 'full'];
export const DEFAULT_FILTER: Filter = 'full';

export function isFilter(value: unknown): value is Filter {
  return value === 'domain' || value === 'path' || value === 'full';
}

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function wildcardToRegExp(pattern: string): RegExp {
  const parts = pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp('^' + parts.join('(.*)') + '$');
}

/**
 * Whether the current page URL matches a stored URL under the active filter.
 * Stored URLs may contain '*' wildcards; the wildcard check applies before
 * the domain/path/full filters. An unknown filter matches everything.
 */
export function fits(
  current: string | null | undefined,
  storage: string | null | undefined,
  filter: Filter | undefined,
): boolean {
  if (!current || !storage) {
    return false;
  }

  current = current.toLowerCase();
  storage = storage.toLowerCase();

  if (storage === '*') {
    return true;
  }

  if (storage.includes('*')) {
    return wildcardToRegExp(storage).test(current);
  }

  const currentUrl = parseUrl(current);
  const storedUrl = parseUrl(storage);
  if (!currentUrl || !storedUrl) {
    return false;
  }

  switch (filter) {
    case 'domain':
      return currentUrl.host === storedUrl.host;
    case 'path':
      return (
        currentUrl.protocol + currentUrl.host + currentUrl.pathname ===
        storedUrl.protocol + storedUrl.host + storedUrl.pathname
      );
    case 'full':
      return current === storage;
    default:
      console.warn('FillFaster: filter value is wrong: ' + String(filter));
      return true;
  }
}

/**
 * Values captured by the '*' wildcards of storedUrl in currentUrl, or null
 * when storedUrl has no wildcards or does not match currentUrl.
 */
export function getWildcardValues(currentUrl: string, storedUrl: string | null | undefined): string[] | null {
  if (!storedUrl || storedUrl === '*' || !storedUrl.includes('*')) {
    return null;
  }
  const matches = wildcardToRegExp(storedUrl).exec(currentUrl);
  if (!matches) {
    return null;
  }
  return matches.slice(1);
}

/**
 * Replaces {1}, {2}, ... placeholders in every string value of content with
 * the values captured by the '*' wildcards of storedUrl in currentUrl.
 * Unresolvable placeholders are left untouched.
 */
export function applyWildcardValues(content: FormContent, currentUrl: string, storedUrl: string | null | undefined): void {
  const captures = getWildcardValues(currentUrl, storedUrl);
  if (!captures) {
    return;
  }
  for (const key of Object.keys(content)) {
    const value = content[key];
    if (typeof value !== 'string') {
      continue;
    }
    content[key] = value.replace(/\{(\d+)\}/g, (match, index: string) => {
      const capture = captures[parseInt(index, 10) - 1];
      return capture === undefined ? match : capture;
    });
  }
}
