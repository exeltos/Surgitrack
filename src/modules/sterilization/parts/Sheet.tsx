import type {ReactNode} from 'react';
import {ArrowLeft} from 'lucide-react';
import {tr} from '../../../i18n';

/**
 * A Sterilization work card (receipt, assembly, load, release, delivery…) opened inside the page, in place of
 * the queue, like any other screen: with a way back to the list, instead of a dialog over everything.
 */
export default function Sheet({onClose, children}: {onClose: () => void; children: ReactNode}) {
  return (
    <div className="ster-sheet">
      <button type="button" className="ster-sheet-back" onClick={onClose}>
        <ArrowLeft size={16} /> {tr('Πίσω στη λίστα')}
      </button>
      {children}
    </div>
  );
}
