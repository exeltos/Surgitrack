import type {useConfirm} from './useConfirm';

type Ask = Parameters<ReturnType<typeof useConfirm>[1]>[0];
type Question = Omit<Ask, 'onConfirm' | 'onCancel'>;

let open: ((ask: Ask) => void) | null = null;

/** Where ConfirmHost shows the questions; null when it unmounts (only the one that set it clears it). */
export const setConfirmOpener = (next: ((ask: Ask) => void) | null) => {
  open = next;
};
export const confirmOpener = () => open;

/**
 * The app's own confirmation, from anywhere (hooks, event handlers, async flows): resolves to the note text
 * ('' without a note) when confirmed, or `false` when closed. Needs one {@link ConfirmHost} on the page;
 * without it (isolated tests) it falls back to the browser's dialog.
 */
export function askConfirm(question: Question): Promise<string | false> {
  if (!open) {
    if (question.note) return Promise.resolve(window.prompt(question.message, question.note.initial) || false);
    return Promise.resolve(window.confirm(question.message) ? '' : false);
  }
  const show = open;
  return new Promise(resolve => show({...question, onConfirm: resolve, onCancel: () => resolve(false)}));
}

/** A message to acknowledge, with one button. */
export const tellUser = (title: string, message: string) =>
  askConfirm({title, message, notice: true, confirmLabel: 'OK'}).then(() => undefined);
