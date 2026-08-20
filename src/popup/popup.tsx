import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import browser from 'webextension-polyfill';
import { DEFAULT_FILTER, fits } from '../shared/matching';
import { DEFAULT_PREFIX } from '../shared/datetime';
import {
  getAiConfig,
  loadAll,
  removeSets,
  saveAiConfig,
  saveFilter,
  savePrefixWithMigration,
  saveSet,
  type AiConfig,
} from '../shared/storage';
import type { Filter, SetSettings, StoreResponse } from '../shared/types';
import './popup.css';

type Block =
  | { kind: 'none' }
  | { kind: 'export'; id: string }
  | { kind: 'hotkey'; id: string }
  | { kind: 'import' }
  | { kind: 'prefix' }
  | { kind: 'ai' };

async function sendToActiveTab<T>(message: unknown): Promise<T> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || tab.id === undefined) {
    throw new Error('no active tab');
  }
  return (await browser.tabs.sendMessage(tab.id, message)) as T;
}

function shortUrl(url: string): string {
  return url.length > 40 ? url.slice(0, 40) + '...' : url;
}

export function App(): React.JSX.Element {
  const [tabUrl, setTabUrl] = useState('');
  const [sets, setSets] = useState<Record<string, SetSettings>>({});
  const [filter, setFilter] = useState<Filter>(DEFAULT_FILTER);
  const [allSets, setAllSets] = useState(false);
  const [error, setError] = useState('');
  const [block, setBlock] = useState<Block>({ kind: 'none' });
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const loaded = await loadAll();
    setSets(loaded.sets);
    if (loaded.filter) {
      setFilter(loaded.filter);
    } else {
      await saveFilter(DEFAULT_FILTER);
      setFilter(DEFAULT_FILTER);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      setTabUrl(tabs[0]?.url ?? '');
      await refresh();
    })();
  }, [refresh]);

  const visibleSets = useMemo(() => {
    const out: Record<string, SetSettings> = {};
    for (const [id, set] of Object.entries(sets)) {
      if (allSets || fits(tabUrl, set.url, filter)) {
        out[id] = set;
      }
    }
    return out;
  }, [sets, allSets, tabUrl, filter]);

  const entries = useMemo(() => Object.entries(visibleSets), [visibleSets]);

  const handleStore = async (): Promise<void> => {
    try {
      const response = await sendToActiveTab<StoreResponse>({ action: 'store' });
      if (response === undefined || response === null) {
        setError('Error :( Null response from content script');
        return;
      }
      if (response.error) {
        setError("Error :'( " + response.message);
        return;
      }
      setError('');
      const id = String(Date.now());
      const set: SetSettings = {
        url: tabUrl,
        autoSubmit: false,
        submitQuery: '',
        content: response.content,
        name: id,
        hotkey: '',
      };
      await saveSet(id, set);
      await refresh();
    } catch {
      setError('Error :( Something wrong with current tab. Try to reload it.');
    }
  };

  const handleRestore = async (id: string): Promise<void> => {
    const set = sets[id];
    if (!set) {
      return;
    }
    await sendToActiveTab({ action: 'fill', setSettings: set });
    window.close();
  };

  const handleSubmitToggle = async (id: string): Promise<void> => {
    const set = sets[id];
    if (!set) {
      return;
    }
    if (set.autoSubmit) {
      set.autoSubmit = false;
      await saveSet(id, set);
      await refresh();
      return;
    }
    const query = window.prompt(
      'Enter jquery selector for submit button to auto click',
      set.submitQuery || 'input[type=submit]',
    );
    if (!query) {
      return;
    }
    set.submitQuery = query;
    set.autoSubmit = true;
    await saveSet(id, set);
    await refresh();
  };

  const handleDelete = async (id: string): Promise<void> => {
    await removeSets([id]);
    await refresh();
  };

  const handleFilter = async (value: Filter): Promise<void> => {
    setFilter(value);
    await saveFilter(value);
    await refresh();
  };

  const handleClearSets = async (): Promise<void> => {
    const ids = Object.entries(sets)
      .filter(([, set]) => fits(tabUrl, set.url, filter))
      .map(([id]) => id);
    await removeSets(ids);
    await refresh();
  };

  const handleClearEverything = async (): Promise<void> => {
    if (!window.confirm('Are you sure?!?')) {
      return;
    }
    await browser.storage.sync.clear();
    setAllSets(false);
    await refresh();
  };

  const commitRename = async (id: string, value: string): Promise<void> => {
    setRenamingId(null);
    if (!value) {
      return;
    }
    const set = sets[id];
    if (!set || set.name === value) {
      return;
    }
    set.name = value;
    await saveSet(id, set);
    await refresh();
  };

  const closeMenu = (): void => {
    document.getElementById('menu')?.removeAttribute('open');
  };

  const exportSet = block.kind === 'export' ? sets[block.id] : undefined;
  const hotkeySet = block.kind === 'hotkey' ? sets[block.id] : undefined;

  return (
    <div>
      <div id="error" className={error ? '' : 'hidden'}>
        <h6>{error}</h6>
      </div>

      <div className="toolbar">
        <button type="button" id="store" className="btn" title="Save the current form" onClick={() => void handleStore()}>
          Save form
        </button>
        <button type="button" id="import" className="btn" title="Import JSON of a saved form" onClick={() => { setBlock({ kind: 'import' }); closeMenu(); }}>
          Import
        </button>
        <button
          type="button"
          id="clearall"
          className="btn"
          title="Clear all sets for current URL"
          disabled={allSets || entries.length === 0}
          onClick={() => void handleClearSets()}
        >
          Clear sets
        </button>
        <details id="menu">
          <summary className="btn" title="Options">
            &#9881;
          </summary>
          <ul>
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); setAllSets((v) => !v); closeMenu(); }}>
                {allSets ? 'View sets for this URL' : 'View all saved sets'}
              </a>
            </li>
            <li className="divider" />
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); void handleFilter('domain'); closeMenu(); }} className={filter === 'domain' ? 'active' : ''}>
                Filter by domain
              </a>
            </li>
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); void handleFilter('path'); closeMenu(); }} className={filter === 'path' ? 'active' : ''}>
                Filter by path
              </a>
            </li>
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); void handleFilter('full'); closeMenu(); }} className={filter === 'full' ? 'active' : ''}>
                Filter by full URL
              </a>
            </li>
            <li className="divider" />
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); setBlock({ kind: 'prefix' }); closeMenu(); }}>
                Datetime placeholder prefix...
              </a>
            </li>
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); setBlock({ kind: 'ai' }); closeMenu(); }}>
                AI fill settings...
              </a>
            </li>
            <li className="divider" />
            <li>
              <a href="https://github.com/mathieuf20/FillFaster/issues" target="_blank" rel="noopener">
                Report a problem
              </a>
            </li>
            <li>
              <a href="https://github.com/mathieuf20/FillFaster" target="_blank" rel="noopener">
                Sources on GitHub
              </a>
            </li>
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); closeMenu(); void handleClearEverything(); }}>
                Clear all Extension Data
              </a>
            </li>
          </ul>
        </details>
      </div>

      <div id="nosets" className={entries.length === 0 ? '' : 'hidden'}>
        <h6>No saved sets for this URL (check filter)</h6>
      </div>

      <table id="sets" className={entries.length === 0 ? 'hidden' : ''}>
        <thead>
          <tr>
            <th>Restore</th>
            <th>Set Name</th>
            <th>Submit Form</th>
            <th>Delete</th>
            <th>Export</th>
            <th>Hotkey</th>
            {allSets && <th className="url">URL</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map(([id, set]) => (
            <tr key={id} data-key={id}>
              <td
                className={'restore' + (allSets ? ' disabled' : '')}
                onClick={() => { if (!allSets) void handleRestore(id); }}
              >
                Restore
              </td>
              <td className="setName" onClick={() => setRenamingId(id)}>
                {renamingId === id ? (
                  <RenameInput id={id} initial={set.name} onCommit={commitRename} />
                ) : (
                  set.name
                )}
              </td>
              <td className={'submit' + (set.autoSubmit ? ' active' : '')} onClick={() => void handleSubmitToggle(id)}>
                {set.autoSubmit ? 'Yes' : 'No'}
              </td>
              <td className="remove" onClick={() => void handleDelete(id)}>
                Delete
              </td>
              <td className="export" onClick={() => setBlock({ kind: 'export', id })}>
                Export
              </td>
              <td className="hotkey" onClick={() => setBlock({ kind: 'hotkey', id })}>
                {set.hotkey || 'none'}
              </td>
              {allSets && (
                <td className="url">
                  <a href={set.url} target="_blank" rel="noopener">
                    {shortUrl(set.url)}
                  </a>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {exportSet ? (
        <ExportBlock set={exportSet} onClose={() => setBlock({ kind: 'none' })} />
      ) : null}
      {hotkeySet ? (
        <HotkeyBlock
          id={block.kind === 'hotkey' ? block.id : ''}
          set={hotkeySet}
          onClose={() => setBlock({ kind: 'none' })}
          onSaved={async () => {
            setBlock({ kind: 'none' });
            await refresh();
            try {
              await sendToActiveTab({ action: 'rebind' });
            } catch {
              /* tab without content script */
            }
          }}
        />
      ) : null}
      {block.kind === 'import' && (
        <ImportBlock
          onClose={() => setBlock({ kind: 'none' })}
          onSaved={async () => {
            setBlock({ kind: 'none' });
            await refresh();
          }}
        />
      )}
      {block.kind === 'prefix' && (
        <PrefixBlock
          onClose={() => setBlock({ kind: 'none' })}
          onSaved={async () => {
            setBlock({ kind: 'none' });
            await refresh();
          }}
        />
      )}
      {block.kind === 'ai' && <AiBlock onClose={() => setBlock({ kind: 'none' })} />}
    </div>
  );
}

function RenameInput(props: { id: string; initial: string; onCommit: (id: string, value: string) => void }): React.JSX.Element {
  const [value, setValue] = useState(props.initial);
  return (
    <input
      type="text"
      className="txtSetName"
      value={value}
      autoFocus
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => props.onCommit(props.id, value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          props.onCommit(props.id, value);
        } else if (e.key === 'Escape') {
          props.onCommit(props.id, props.initial);
        }
      }}
    />
  );
}

function ExportBlock(props: { set: SetSettings; onClose: () => void }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(props.set);

  const copy = async (): Promise<void> => {
    const flash = (): void => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(json);
        flash();
        return;
      } catch {
        /* fall back below */
      }
    }
    const textarea = document.createElement('textarea');
    textarea.value = json;
    document.body.append(textarea);
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    textarea.remove();
    if (ok) {
      flash();
    } else {
      window.alert('Could not copy to clipboard automatically. Select the JSON and copy it manually.');
    }
  };

  return (
    <div id="exportBlock" className="block">
      <h4>Save or copy this json to export:</h4>
      <textarea id="txtFormJson" value={json} readOnly />
      <div className="row">
        <button className="btn" onClick={() => void copy()}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button className="btn" onClick={props.onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function HotkeyBlock(props: { id: string; set: SetSettings; onClose: () => void; onSaved: () => void }): React.JSX.Element {
  const [value, setValue] = useState(props.set.hotkey);

  const save = async (): Promise<void> => {
    const set = { ...props.set, hotkey: value.trim() };
    await saveSet(props.id, set);
    props.onSaved();
  };

  return (
    <div id="hotkeyBlock" className="block">
      <h4>Type your hotkey</h4>
      <div className="help">
        <p>
          For modifier keys you can use <code>shift</code>, <code>ctrl</code>, <code>alt</code>, <code>option</code>,{' '}
          <code>meta</code>, and <code>command</code>.
        </p>
        <p>
          Other special keys are <code>backspace</code>, <code>tab</code>, <code>enter</code>, <code>return</code>,{' '}
          <code>capslock</code>, <code>esc</code>, <code>escape</code>, <code>space</code>, <code>pageup</code>,{' '}
          <code>pagedown</code>, <code>end</code>, <code>home</code>, <code>left</code>, <code>up</code>, <code>right</code>,{' '}
          <code>down</code>, <code>ins</code>, and <code>del</code>.
        </p>
        <p>
          Example: <code>ctrl+shift+f</code>
        </p>
      </div>
      <div className="row">
        <input type="text" id="txtHotkey" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} autoFocus />
        <button className="btn" onClick={() => void save()}>
          Save
        </button>
        <button className="btn" onClick={props.onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ImportBlock(props: { onClose: () => void; onSaved: () => void }): React.JSX.Element {
  const [json, setJson] = useState('');

  const paste = async (): Promise<void> => {
    if (!navigator.clipboard?.readText) {
      window.alert('Clipboard access is not supported here. Paste the JSON manually.');
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        window.alert('Clipboard is empty.');
        return;
      }
      setJson(text);
    } catch (e) {
      window.alert('Could not read the clipboard automatically (' + String(e) + '). Paste the JSON manually.');
    }
  };

  const save = async (): Promise<void> => {
    try {
      const imported = JSON.parse(json) as Partial<SetSettings>;
      if (!imported.url || !imported.content || !imported.name) {
        throw new Error('Invalid JSON format');
      }
      if (imported.url === '*') {
        imported.name += '-global';
      }
      await saveSet(String(Date.now()), imported as SetSettings);
      props.onSaved();
    } catch (e) {
      window.alert('Got an error: ' + (e as Error).message);
    }
  };

  return (
    <div id="importBlock" className="block">
      <h4>Paste json to import:</h4>
      <textarea id="txtImportFormJson" rows={8} value={json} onChange={(e) => setJson(e.target.value)} />
      <div className="row">
        <button className="btn" onClick={() => void paste()}>
          Paste
        </button>
        <button className="btn btn-primary" onClick={() => void save()}>
          Save
        </button>
        <button className="btn" onClick={props.onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function PrefixBlock(props: { onClose: () => void; onSaved: () => void }): React.JSX.Element {
  const [prefix, setPrefix] = useState(DEFAULT_PREFIX);

  useEffect(() => {
    void loadAll().then((loaded) => setPrefix(loaded.prefix));
  }, []);

  const save = async (): Promise<void> => {
    const trimmed = prefix.trim();
    if (!trimmed) {
      window.alert(
        'Prefix cannot be empty. It is a marker typed at the start of a field; use the default "' + DEFAULT_PREFIX + '" or a distinctive string.',
      );
      return;
    }
    await savePrefixWithMigration(trimmed);
    props.onSaved();
  };

  return (
    <div id="prefixBlock" className="block">
      <h4>Datetime placeholder prefix</h4>
      <div className="help">
        <p>Fields starting with this prefix have their date/time placeholders filled when a set is restored. Changing it updates all saved sets automatically.</p>
      </div>
      <div className="row">
        <input type="text" id="txtPrefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} autoFocus />
        <button className="btn" onClick={() => void save()}>
          Save
        </button>
        <button className="btn" onClick={props.onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function AiBlock(props: { onClose: () => void }): React.JSX.Element {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void getAiConfig().then((loaded) => {
      setConfig(
        loaded ?? { endpoint: '', apiKey: '', model: '', defaultInstruction: '' },
      );
    });
  }, []);

  const save = async (): Promise<void> => {
    if (!config) {
      return;
    }
    const trimmed = {
      endpoint: config.endpoint.trim(),
      apiKey: config.apiKey.trim(),
      model: config.model.trim(),
      defaultInstruction: config.defaultInstruction.trim(),
    };
    if (!trimmed.apiKey) {
      window.alert('API key is required for AI fill.');
      return;
    }
    await saveAiConfig(trimmed);
    props.onClose();
  };

  const test = async (): Promise<void> => {
    if (!config) {
      return;
    }
    setTesting(true);
    try {
      const response = (await browser.runtime.sendMessage({ action: 'aiTest' })) as {
        error?: boolean;
        message?: string;
        values?: Record<string, string>;
      };
      window.alert(response.error ? 'AI test failed: ' + response.message : 'AI test OK: ' + (response.values?.test ?? ''));
    } catch (e) {
      window.alert('AI test failed: ' + (e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  if (!config) {
    return <div className="block">Loading...</div>;
  }

  const update = (patch: Partial<AiConfig>): void => setConfig({ ...config, ...patch });

  return (
    <div id="aiBlock" className="block">
      <h4>AI fill settings</h4>
      <div className="help">
        <p>
          With AI fill, a field saved with the value <code>@@@AI@@@</code> is filled on restore by a language model. Add
          an instruction after the marker, e.g. <code>@@@AI@@@ a Lebanese-sounding name</code>. Without an instruction,
          the default below is used.
        </p>
        <p>Any OpenAI-compatible chat completions endpoint works (OpenAI, OpenRouter, Groq, Ollama, LM Studio...). The API key is stored in extension storage and sent only to the configured endpoint.</p>
      </div>
      <div className="form">
        <label htmlFor="aiEndpoint">Endpoint (base URL)</label>
        <input id="aiEndpoint" type="text" value={config.endpoint} placeholder="https://api.openai.com/v1" onChange={(e) => update({ endpoint: e.target.value })} />
        <label htmlFor="aiKey">API key</label>
        <input id="aiKey" type="password" value={config.apiKey} onChange={(e) => update({ apiKey: e.target.value })} />
        <label htmlFor="aiModel">Model</label>
        <input id="aiModel" type="text" value={config.model} placeholder="gpt-4o-mini" onChange={(e) => update({ model: e.target.value })} />
        <label htmlFor="aiDefault">Default instruction (optional)</label>
        <input id="aiDefault" type="text" value={config.defaultInstruction} placeholder="a realistic value for this field" onChange={(e) => update({ defaultInstruction: e.target.value })} />
      </div>
      <div className="row">
        <button className="btn" onClick={() => void test()} disabled={testing}>
          {testing ? 'Testing...' : 'Test'}
        </button>
        <button className="btn btn-primary" onClick={() => void save()}>
          Save
        </button>
        <button className="btn" onClick={props.onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
