// Minimal Chrome API stub so webextension-polyfill can load and wrap it in
// the vitest Node environment.
interface Store {
  [key: string]: unknown;
}

let store: Store = {};

function resetChromeStorage(): void {
  store = {};
}

function getChromeStorage(): Store {
  return store;
}

function getStorageResult(key: string | string[] | undefined): Record<string, unknown> {
  if (key === undefined) {
    return { ...store };
  }
  const keys = Array.isArray(key) ? key : [key];
  const result: Record<string, unknown> = {};
  for (const k of keys) {
    if (store[k] !== undefined) {
      result[k] = store[k];
    }
  }
  return result;
}

const chromeApi = {
  runtime: {
    id: 'test-extension',
    onMessage: { addListener: (): void => undefined },
    lastError: null,
    sendMessage: (_message: unknown): Promise<unknown> => Promise.resolve(undefined),
  },
  storage: {
    sync: {
      get: (
        key?: string | string[] | ((result: Record<string, unknown>) => void),
        callback?: (result: Record<string, unknown>) => void,
      ) => {
        if (typeof key === 'function') {
          callback = key;
          key = undefined;
        }
        const result = getStorageResult(key);
        if (callback) {
          callback(result);
          return undefined;
        }
        return Promise.resolve(result);
      },
      set: (items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(store, items);
        if (callback) {
          callback();
          return undefined;
        }
        return Promise.resolve();
      },
      remove: (keys: string | string[], callback?: () => void) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          delete store[key];
        }
        if (callback) {
          callback();
          return undefined;
        }
        return Promise.resolve();
      },
      clear: (callback?: () => void) => {
        store = {};
        if (callback) {
          callback();
          return undefined;
        }
        return Promise.resolve();
      },
    },
  },
  tabs: {
    query: (): Promise<unknown[]> => Promise.resolve([]),
    sendMessage: (): Promise<unknown> => Promise.resolve(undefined),
  },
};

(globalThis as unknown as { chrome: unknown }).chrome = chromeApi;
(globalThis as unknown as { __fasrStorage: () => Store }).__fasrStorage = getChromeStorage;
(globalThis as unknown as { __fasrResetStorage: () => void }).__fasrResetStorage = resetChromeStorage;
