import {useCallback, useState, type ReactNode} from 'react';
import ConfirmDialog from './ConfirmDialog';

type Ask = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  note?: {label: string; placeholder?: string};
  onConfirm: (note: string) => void;
};

/**
 * Asks before an action runs: `ask({...})` opens the confirmation; the action runs only on the confirm
 * button. Render the returned node once in the page.
 */
export function useConfirm(): [ReactNode, (ask: Ask) => void] {
  const [pending, setPending] = useState<Ask | null>(null);
  const ask = useCallback((next: Ask) => setPending(next), []);
  const node = pending ? (
    <ConfirmDialog
      title={pending.title}
      message={pending.message}
      confirmLabel={pending.confirmLabel}
      cancelLabel={pending.cancelLabel}
      danger={pending.danger}
      note={pending.note}
      onClose={() => setPending(null)}
      onConfirm={text => {
        const run = pending.onConfirm;
        setPending(null);
        run(text);
      }}
    />
  ) : null;
  return [node, ask];
}
