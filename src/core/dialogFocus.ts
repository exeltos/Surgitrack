/**
 * Keyboard and screen-reader behaviour shared by every modal dialog (role="dialog" aria-modal="true"),
 * installed once for the whole app instead of repeated in the thirty dialogs:
 *  - focus moves into the dialog when it opens (unless the dialog already took it, e.g. autoFocus);
 *  - Tab and Shift+Tab stay inside the dialog in front;
 *  - when it closes, focus returns to what had it before, so a keyboard user keeps their place;
 *  - a dialog with no accessible name is named by its first heading.
 * (Escape is handled separately: see installEscapeClosesDialogs.)
 */
const MODAL = '[role="dialog"][aria-modal="true"]';
const TABBABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const tabbables = (dialog: HTMLElement) =>
  [...dialog.querySelectorAll<HTMLElement>(TABBABLE)].filter(el => !el.closest('[hidden],[inert]'));

const modalsIn = (node: Node): HTMLElement[] => {
  if (!(node instanceof HTMLElement)) return [];
  return [...(node.matches(MODAL) ? [node] : []), ...node.querySelectorAll<HTMLElement>(MODAL)];
};

let counter = 0;
const nameFromHeading = (dialog: HTMLElement) => {
  if (dialog.hasAttribute('aria-label') || dialog.hasAttribute('aria-labelledby')) return;
  const heading = dialog.querySelector<HTMLElement>('h1,h2,h3,h4');
  if (!heading) return;
  if (!heading.id) heading.id = `dialog-title-${++counter}`;
  dialog.setAttribute('aria-labelledby', heading.id);
};

/** The dialog in front: the last one in the page (a dialog opened from another is rendered after it). */
const frontModal = () => [...document.querySelectorAll<HTMLElement>(MODAL)].filter(el => el.isConnected).pop();

export function installDialogFocus() {
  /** What had focus outside any dialog, to give it back when the dialog closes. */
  let lastOutside: HTMLElement | undefined;
  const openers = new WeakMap<HTMLElement, HTMLElement | undefined>();

  document.addEventListener(
    'focusin',
    event => {
      const target = event.target;
      if (target instanceof HTMLElement && !target.closest(MODAL)) lastOutside = target;
    },
    true,
  );

  document.addEventListener(
    'keydown',
    event => {
      if (event.key !== 'Tab' || event.defaultPrevented) return;
      const dialog = frontModal();
      if (!dialog) return;
      const list = tabbables(dialog);
      if (!list.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && dialog.contains(active);
      if (event.shiftKey && (!inside || active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    },
    true,
  );

  const observer = new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(node =>
        modalsIn(node).forEach(dialog => {
          if (openers.has(dialog)) return;
          openers.set(dialog, lastOutside);
          nameFromHeading(dialog);
          if (dialog.contains(document.activeElement)) return;
          if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
          (tabbables(dialog)[0] || dialog).focus();
        }),
      );
      record.removedNodes.forEach(node =>
        modalsIn(node).forEach(dialog => {
          const opener = openers.get(dialog);
          openers.delete(dialog);
          // Only when nothing else has taken focus meanwhile, and no other dialog is open in front.
          const free = !document.activeElement || document.activeElement === document.body;
          if (opener?.isConnected && free && !frontModal()) opener.focus();
        }),
      );
    }
  });
  observer.observe(document.body, {childList: true, subtree: true});
  return () => observer.disconnect();
}
