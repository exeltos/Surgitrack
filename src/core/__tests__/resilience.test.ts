import {describe, expect, it, vi} from 'vitest';
import {installEscapeClosesDialogs, isChunkLoadError} from '../resilience';

installEscapeClosesDialogs();

const escape = () => window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));

describe('Escape closes the dialog in front', () => {
  it('clicks the × of the topmost dialog, even without a label', () => {
    document.body.innerHTML = `
      <div class="modal-backdrop" id="outer"><header><button class="icon-button" id="outer-x">x</button></header>
        <div class="nested-modal-backdrop"><header><button class="icon-button" id="inner-x">x</button></header></div>
      </div>`;
    const outer = vi.fn();
    const inner = vi.fn();
    document.getElementById('outer-x')!.addEventListener('click', outer);
    document.getElementById('inner-x')!.addEventListener('click', inner);
    // jsdom has no layout: treat every backdrop as visible.
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    escape();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  it('prefers a labelled Close / Cancel button', () => {
    document.body.innerHTML = `<div class="movement-modal-backdrop"><button aria-label="Κλείσιμο" id="c">x</button><button>Αποθήκευση</button></div>`;
    const close = vi.fn();
    document.getElementById('c')!.addEventListener('click', close);
    escape();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('chunk load errors', () => {
  it('recognises a page file that is gone after a new version', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/Sets-abc.js'))).toBe(
      true,
    );
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});
