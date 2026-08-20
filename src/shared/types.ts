export type Filter = 'domain' | 'path' | 'full';

export interface SetSettings {
  name: string;
  url: string;
  autoSubmit: boolean;
  submitQuery: string;
  /** JSON-serialized Record<string, string> of the captured form values. */
  content: string;
  hotkey: string;
}

export type FormContent = Record<string, string>;

export interface StoreResponse {
  content: string;
  error?: boolean;
  message?: string;
}

export interface FillResponse {
  error?: boolean;
  message?: string;
}
