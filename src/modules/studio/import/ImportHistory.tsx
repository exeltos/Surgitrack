import {RotateCcw} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import type {ImportState} from './useAssetImport';

export default function ImportHistory({s, asPage}: {s: ImportState; asPage: boolean}) {
  const {L, busy, formatDate, imports, organizationId, setError, setUndoTarget} = s;
  return (
    <>
      {organizationId && (
        <section className="asset-import-history">
          <h3 {...(asPage ? {role: 'heading', 'aria-level': 2} : {})}>
            {L('Εισαγωγές σε αυτό το νοσοκομείο', 'Imports into this hospital')}
          </h3>
          {imports.length === 0 ? (
            <small>{L('Καμία εισαγωγή ακόμη.', 'No imports yet.')}</small>
          ) : (
            imports.map(item => (
              <div key={item.id} className={item.undoneAt ? 'undone' : ''}>
                <span>
                  <b>{item.fileName}</b>
                  <small>
                    {formatDate(item.createdAt)}
                    {item.createdByName ? ` · ${item.createdByName}` : ''} ·{' '}
                    {L(`${item.sets} Σετ, ${item.tools} εργαλεία`, `${item.sets} Sets, ${item.tools} instruments`)}
                  </small>
                </span>
                {item.undoneAt ? (
                  <small>
                    {L('Αναιρέθηκε', 'Undone')} {formatDate(item.undoneAt)}
                    {item.undoneByName ? ` · ${item.undoneByName}` : ''}
                  </small>
                ) : (
                  <AppButton
                    variant="danger"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      setError('');
                      setUndoTarget(item);
                    }}
                  >
                    <RotateCcw size={15} />
                    {L('Αναίρεση', 'Undo')}
                  </AppButton>
                )}
              </div>
            ))
          )}
        </section>
      )}
    </>
  );
}
