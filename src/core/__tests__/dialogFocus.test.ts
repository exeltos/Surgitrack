import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {installDialogFocus} from '../dialogFocus';

let stop: () => void;
beforeAll(() => {
  stop = installDialogFocus();
});
afterAll(() => stop());

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const tab = (shift = false) => {
  const event = new KeyboardEvent('keydown', {key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true});
  document.activeElement?.dispatchEvent(event);
  return event;
};
const openDialog = async (html: string) => {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  await flush();
  return host;
};

describe('modal dialogs', () => {
  it('takes focus on opening, is named by its heading, and gives focus back on closing', async () => {
    document.body.innerHTML = '<button id="opener">Open</button>';
    const opener = document.getElementById('opener') as HTMLButtonElement;
    opener.focus();
    const host = await openDialog(
      '<div role="dialog" aria-modal="true"><h3>Delete the Set?</h3><button id="a">A</button><button id="b">B</button></div>',
    );
    const dialog = host.firstElementChild as HTMLElement;
    expect(document.activeElement?.id).toBe('a');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby') || '')?.textContent).toBe('Delete the Set?');

    host.remove();
    await flush();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps an explicit name and a focus the dialog already took', async () => {
    document.body.innerHTML = '';
    const host = document.createElement('div');
    host.innerHTML =
      '<div role="dialog" aria-modal="true" aria-label="Own name"><h3>Other</h3><input id="x"/><button id="y">Y</button></div>';
    document.body.append(host);
    (host.querySelector('#y') as HTMLElement).focus();
    await flush();
    expect(document.activeElement?.id).toBe('y');
    expect(host.firstElementChild?.hasAttribute('aria-labelledby')).toBe(false);
    host.remove();
  });

  it('keeps Tab and Shift+Tab inside', async () => {
    document.body.innerHTML = '<button id="behind">Behind</button>';
    const host = await openDialog(
      '<div role="dialog" aria-modal="true"><button id="a">A</button><button id="b">B</button></div>',
    );
    (document.getElementById('b') as HTMLElement).focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('a');
    expect(tab(true).defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('b');
    // In the middle of the dialog the browser moves focus by itself.
    (document.getElementById('a') as HTMLElement).focus();
    expect(tab().defaultPrevented).toBe(false);
    host.remove();
  });

  it('leaves the page alone when no dialog is open', () => {
    document.body.innerHTML = '<button id="p">P</button>';
    (document.getElementById('p') as HTMLElement).focus();
    expect(tab().defaultPrevented).toBe(false);
  });
});
