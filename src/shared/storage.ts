import browser from 'webextension-polyfill';
import { DEFAULT_AI_ENDPOINT, DEFAULT_AI_MODEL } from './ai';
import { DEFAULT_PREFIX } from './datetime';
import { isFilter } from './matching';
import type { Filter, SetSettings } from './types';

export const AI_CONFIG_KEY = 'aiConfig';

export interface AiConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  /** Applied when a field has no per-field instruction. */
  defaultInstruction: string;
}

export interface LoadedSets {
  sets: Record<string, SetSettings>;
  filter: Filter | undefined;
  prefix: string;
}

export function isSetSettings(value: unknown): value is SetSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const set = value as Record<string, unknown>;
  return typeof set.url === 'string' && typeof set.content === 'string' && typeof set.name === 'string';
}

/**
 * Splits the raw storage contents into sets, filter and prefix. Junk entries
 * (non-set keys) are dropped.
 */
export function splitStorage(all: Record<string, unknown>): LoadedSets {
  const sets: Record<string, SetSettings> = {};
  let filter: Filter | undefined;
  let prefix = DEFAULT_PREFIX;

  for (const [key, value] of Object.entries(all)) {
    if (key === 'filter') {
      if (isFilter(value)) {
        filter = value;
      }
      continue;
    }
    if (key === 'prefix') {
      if (typeof value === 'string' && value.length > 0) {
        prefix = value;
      }
      continue;
    }
    if (isSetSettings(value)) {
      sets[key] = value;
    }
  }

  return { sets, filter, prefix };
}

export function loadAll(): Promise<LoadedSets> {
  return browser.storage.sync.get().then((all) => splitStorage(all as Record<string, unknown>));
}

export function saveSet(id: string, set: SetSettings): Promise<void> {
  return browser.storage.sync.set({ [id]: set });
}

export function removeSets(ids: string[]): Promise<void> {
  return ids.length > 0 ? browser.storage.sync.remove(ids) : Promise.resolve();
}

export function saveFilter(filter: Filter): Promise<void> {
  return browser.storage.sync.set({ filter });
}

/** Rewrites oldPrefix occurrences in every set's content to newPrefix. */
export function migratePrefixInSets(sets: Record<string, SetSettings>, oldPrefix: string, newPrefix: string): void {
  if (newPrefix === oldPrefix) {
    return;
  }
  for (const set of Object.values(sets)) {
    if (set.content.includes(oldPrefix)) {
      set.content = set.content.split(oldPrefix).join(newPrefix);
    }
  }
}

/** Stores the new prefix, migrating every saved set's content along the way. */
export async function savePrefixWithMigration(newPrefix: string): Promise<void> {
  const all = (await browser.storage.sync.get()) as Record<string, unknown>;
  const oldPrefix = typeof all.prefix === 'string' && all.prefix.length > 0 ? all.prefix : DEFAULT_PREFIX;
  const { sets } = splitStorage(all);
  migratePrefixInSets(sets, oldPrefix, newPrefix);

  const merged: Record<string, unknown> = { ...all };
  for (const [id, set] of Object.entries(sets)) {
    merged[id] = set;
  }
  merged.prefix = newPrefix;
  await browser.storage.sync.set(merged);
}

export async function getAiConfig(): Promise<AiConfig | null> {
  const all = (await browser.storage.sync.get(AI_CONFIG_KEY)) as Record<string, unknown>;
  const raw = all[AI_CONFIG_KEY];
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const config = raw as Record<string, unknown>;
  return {
    endpoint: typeof config.endpoint === 'string' && config.endpoint.length > 0 ? config.endpoint : DEFAULT_AI_ENDPOINT,
    apiKey: typeof config.apiKey === 'string' ? config.apiKey : '',
    model: typeof config.model === 'string' && config.model.length > 0 ? config.model : DEFAULT_AI_MODEL,
    defaultInstruction: typeof config.defaultInstruction === 'string' ? config.defaultInstruction : '',
  };
}

export function saveAiConfig(config: AiConfig): Promise<void> {
  return browser.storage.sync.set({ [AI_CONFIG_KEY]: config });
}
