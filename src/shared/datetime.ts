export const DEFAULT_PREFIX = '@@@DTPH@@@';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Strips the prefix and fills the date/time placeholders.
 * Values not starting with the prefix are returned untouched.
 */
export function replaceDateTimePlaceholders(value: string, prefix: string, now: Date = new Date()): string {
  return value
    .slice(prefix.length)
    .replace('%%', '$%%$')
    .replace('%H', pad2(now.getHours()))
    .replace('%M', pad2(now.getMinutes()))
    .replace('%S', pad2(now.getSeconds()))
    .replace('%d', pad2(now.getDate()))
    .replace('%m', pad2(now.getMonth() + 1))
    .replace('%y', String(now.getFullYear()))
    .replace('$%%$', '%');
}

/** True when the value carries the datetime placeholder prefix. */
export function shouldTransform(value: string, prefix: string): boolean {
  return prefix.length > 0 && value.startsWith(prefix);
}
