import {CheckCircle2, TriangleAlert, ArrowRight, X} from 'lucide-react';
import {tr} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';
import {SET_SHORTAGE_CODE} from '../hooks/usePreparationChecks';

export default function PrepMissingModal({s}: {s: SterilizationPageState}) {
  const {
    acceptMissingWithoutAction,
    canCompose,
    closePrepManage,
    openCompositionShortageReport,
    prepDraft,
    prepManageMissing,
    setPrepManageMissingCode,
    setPrepOutgoingDestination,
    setPrepOutgoingSetId,
    setPrepReplacementId,
    setPrepReplacementRequirement,
    setPrepReplacementSetId,
    setPrepReplacementSource,
    setPrepSelectedToolId,
    setPrepTargetSetId,
    setPrepToolAction,
  } = s;
  return (
    <>
      {prepManageMissing && prepDraft?.kind === 'SET' && (
        <div className="nested-modal-backdrop" onMouseDown={closePrepManage}>
          <div className="tool-issue-card prep-manage-card" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closePrepManage}>
              <X size={17} />
            </button>
            <span className="eyebrow">{tr('ΔΙΑΧΕΙΡΙΣΗ ΕΛΛΕΙΨΗΣ')}</span>
            <h3>{prepManageMissing.name}</h3>
            <div className="prep-manage-summary">
              <span>
                {prepManageMissing.code === SET_SHORTAGE_CODE
                  ? tr('Λείπουν {0} από {1} εργαλεία του Σετ', prepManageMissing.missing, prepManageMissing.quantity)
                  : `${prepManageMissing.code} ${tr('· λείπουν')} ${prepManageMissing.missing} ${tr('από')} ${prepManageMissing.quantity}`}
              </span>
            </div>
            <div className="prep-manage-grid">
              {canCompose && (
                <button
                  type="button"
                  onClick={() => {
                    setPrepSelectedToolId(null);
                    setPrepReplacementRequirement({code: prepManageMissing.code, name: prepManageMissing.name});
                    setPrepManageMissingCode(null);
                    setPrepToolAction('REPLACE');
                    setPrepReplacementId('');
                    setPrepReplacementSource('STOCK');
                    setPrepReplacementSetId('');
                    setPrepOutgoingDestination('STOCK');
                    setPrepOutgoingSetId('');
                    setPrepTargetSetId('');
                  }}
                >
                  <ArrowRight size={16} />
                  <span>
                    <b>{tr('Κάλυψη έλλειψης')}</b>
                    <small>{tr('Επιλογή εργαλείου από Απόθεμα, άλλο Set ή μεμονωμένο')}</small>
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setPrepManageMissingCode(null);
                  openCompositionShortageReport();
                }}
              >
                <TriangleAlert size={16} />
                <span>
                  <b>{tr('Αναφορά')}</b>
                  <small>{tr('Καταγραφή της έλλειψης ως απόκλιση του Set')}</small>
                </span>
              </button>
              <button
                type="button"
                className="prep-no-action-option"
                onClick={() => acceptMissingWithoutAction(prepManageMissing.code)}
              >
                <CheckCircle2 size={16} />
                <span>
                  <b>{tr('Παραμονή ως έχει')}</b>
                  <small>{tr('Καταγραφή της έλλειψης και συνέχιση της διαδικασίας')}</small>
                </span>
              </button>
            </div>
            {!canCompose && (
              <p className="prep-supervisor-note">
                {tr('Αλλαγές στη σύνθεση του Set (αντικατάσταση, Service, Απόθεμα) κάνει ο Προϊστάμενος Αποστείρωσης.')}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
