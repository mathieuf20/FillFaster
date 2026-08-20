import { beforeEach, describe, expect, it } from 'vitest';
import { fillForm, serializeForm } from '../src/content/form-io';

const NOW = new Date(2020, 0, 5, 6, 7, 8);

beforeEach(() => {
  document.body.innerHTML = `
    <form id="f">
      <input type="text" id="city" name="city" value="Paris" />
      <input type="checkbox" id="ok" value="on" checked />
      <input type="checkbox" id="no" name="noval" value="on" />
      <input type="radio" name="color" value="red" checked />
      <input type="radio" name="color" value="blue" />
      <select id="size"><option value="s">S</option><option value="l" selected>L</option></select>
      <textarea id="notes">hi</textarea>
      <input type="password" id="pw" value="secret" />
      <input type="hidden" id="h" value="skip" />
      <input type="submit" id="sub" value="Go" />
      <button id="btn">B</button>
      <input type="text" value="noname" />
      <input type="text" id="__VIEWSTATE" value="skipme" />
      <input type="date" id="d" value="2020-01-05" />
      <input type="text" id="empty" value="" />
      <input type="text" id="off" value="x" disabled />
      <input type="text" name="dup" value="a" />
      <input type="text" name="dup" value="b" />
    </form>
  `;
});

function root(): HTMLElement {
  return document.querySelector('#f') as HTMLFormElement;
}

describe('serializeForm', () => {
  it('captures the expected values only', () => {
    const content = serializeForm(root());
    expect(content).toEqual({
      city: 'Paris',
      ok: 'true',
      no: 'false',
      color: 'red',
      size: 'l',
      notes: 'hi',
      pw: 'secret',
      d: '2020-01-05',
      off: 'x',
      dup: 'a,b',
    });
  });

  it('does not join when ids differ', () => {
    root().insertAdjacentHTML('beforeend', '<input type="text" id="city2" name="city" value="Lyon" />');
    const content = serializeForm(root());
    expect(content.city).toBe('Paris');
    expect(content.city2).toBe('Lyon');
  });
});

describe('fillForm', () => {
  it('fills values, checks radios and expands datetime placeholders', () => {
    const content = {
      city: '{1}',
      ok: 'false',
      color: 'blue',
      size: 's',
      notes: '@@@DTPH@@@%y-%m-%d',
      pw: 'x',
      d: '@@@DTPH@@@%y-%m-%d',
      empty: 'now-set',
      off: 'ignored',
    };
    // wildcard substitution happens before fill in the content script
    content.city = content.city.replace('{1}', 'Lyon');

    fillForm(root(), content, { prefix: '@@@DTPH@@@', now: NOW });

    const city = document.querySelector<HTMLInputElement>('#city')!;
    const ok = document.querySelector<HTMLInputElement>('#ok')!;
    const red = document.querySelector<HTMLInputElement>('input[name=color][value=red]')!;
    const blue = document.querySelector<HTMLInputElement>('input[name=color][value=blue]')!;
    const size = document.querySelector<HTMLSelectElement>('#size')!;
    const notes = document.querySelector<HTMLTextAreaElement>('#notes')!;
    const d = document.querySelector<HTMLInputElement>('#d')!;
    const empty = document.querySelector<HTMLInputElement>('#empty')!;
    const off = document.querySelector<HTMLInputElement>('#off')!;

    expect(city.value).toBe('Lyon');
    expect(ok.checked).toBe(false);
    expect(red.checked).toBe(false);
    expect(blue.checked).toBe(true);
    expect(size.value).toBe('s');
    expect(notes.value).toBe('2020-01-05');
    expect(d.value).toBe('2020-01-05');
    expect(empty.value).toBe('now-set');
    expect(off.value).toBe('x'); // disabled inputs are left alone
  });

  it('leaves legacy-prefix values raw when a custom prefix is configured', () => {
    fillForm(root(), { city: '@@@DTPH@@@%y' }, { prefix: '[[P]]', now: NOW });
    expect(document.querySelector<HTMLInputElement>('#city')!.value).toBe('@@@DTPH@@@%y');
  });

  it('disables transformation with an empty prefix', () => {
    fillForm(root(), { city: '@@@DTPH@@@%y' }, { prefix: '', now: NOW });
    expect(document.querySelector<HTMLInputElement>('#city')!.value).toBe('@@@DTPH@@@%y');
  });

  it('sets checkbox true from saved "true"', () => {
    fillForm(root(), { ok: 'true' });
    expect(document.querySelector<HTMLInputElement>('#ok')!.checked).toBe(true);
  });
});
