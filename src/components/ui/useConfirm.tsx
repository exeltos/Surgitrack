import {useCallback, useState, type ReactNode} from 'react';
import ConfirmDialog from './ConfirmDialog';

type Ask = {title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void};

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
      danger={pending.danger}
      onClose={() => setPending(null)}
      onConfirm={() => {
        const run = pending.onConfirm;
        setPending(null);
        run();
      }}
    />
  ) : null;
  return [node, ask];
}
