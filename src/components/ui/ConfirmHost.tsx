import {useEffect} from 'react';
import {confirmOpener, setConfirmOpener} from './confirmService';
import {useConfirm} from './useConfirm';

/** Renders the dialogs {@link askConfirm} opens. Mount once. */
export function ConfirmHost() {
  const [node, ask] = useConfirm();
  useEffect(() => {
    setConfirmOpener(ask);
    return () => {
      if (confirmOpener() === ask) setConfirmOpener(null);
    };
  }, [ask]);
  return node;
}
