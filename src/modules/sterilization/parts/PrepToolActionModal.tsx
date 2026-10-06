import {CheckCircle2, TriangleAlert, X} from 'lucide-react';
import {tr} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function PrepToolActionModal({s}: {s: SterilizationPageState}) {
  const {
    applyPrepToolAction,
    closePrepToolAction,
    prepDraft,
    prepOtherSets,
    prepOutgoingDestination,
    prepOutgoingSetId,
    prepReplacementCandidates,
    prepReplacementId,
    prepReplacementRequirement,
    prepReplacementSetId,
    prepReplacementSource,
    prepReplacementSourceSets,
    prepReplacementTargetCode,
    prepSelectedTool,
    prepTargetSetId,
    prepToolAction,
    setPrepOutgoingDestination,
    setPrepOutgoingSetId,
    setPrepReplacementId,
    setPrepReplacementSetId,
    setPrepReplacementSource,
    setPrepTargetSetId,
    sets,
    tools,
  } = s;
  return (
    <>
      {prepToolAction && prepDraft?.kind === 'SET' && (prepSelectedTool || prepReplacementRequirement) && (
        <div className="nested-modal-backdrop" onMouseDown={closePrepToolAction}>
          <div className="tool-issue-card prep-tool-action-card" onMouseDown={e => e.stopPropagation()}>
            <button
              className="modal-x"
              aria-label={tr('Κλείσιμο')}
              title={tr('Κλείσιμο')}
              onClick={closePrepToolAction}
            >
              <X size={17} />
            </button>
            <span className="eyebrow">{tr('ΔΙΑΧΕΙΡΙΣΗ ΣΥΝΘΕΣΗΣ')}</span>
            <h3>
              {prepSelectedTool
                ? `${prepSelectedTool.barcode} · ${prepSelectedTool.name}`
                : tr('Κάλυψη έλλειψης · {0}', prepReplacementRequirement?.name || '')}
            </h3>
            <p className="prep-action-intro">
              {prepToolAction === 'REPLACE'
                ? prepSelectedTool
                  ? tr(
                      'Η αντικατάσταση ολοκληρώνεται ως μία ενιαία κίνηση: ορίζεις πού πηγαίνει το υπάρχον εργαλείο και ποιο φυσικό εργαλείο μπαίνει στη θέση του.',
                    )
                  : tr(
                      'Επίλεξε το φυσικό εργαλείο που θα καλύψει την έλλειψη. Με την επιβεβαίωση θα προστεθεί στο Set.',
                    )
                : prepToolAction === 'SERVICE'
                  ? tr('Το εργαλείο θα αφαιρεθεί από το Set και θα μεταφερθεί στα Χαλασμένα / Service.')
                  : prepToolAction === 'STOCK'
                    ? tr('Το εργαλείο θα αφαιρεθεί από το Set και θα επιστρέψει στο κεντρικό Απόθεμα.')
                    : tr('Το εργαλείο θα αφαιρεθεί από το τρέχον Set και θα προστεθεί σε άλλο Set.')}
            </p>
            {prepToolAction === 'REPLACE' && (
              <>
                {prepSelectedTool && (
                  <div className="prep-replace-flow">
                    <div className="prep-replace-step">
                      <span>1</span>
                      <div>
                        <strong>{tr('Εργαλείο που αφαιρείται')}</strong>
                        <small>
                          {prepSelectedTool.barcode} · {prepSelectedTool.name}
                        </small>
                      </div>
                    </div>
                    <div className="prep-replace-destination">
                      <strong>{tr('Πού θα μεταφερθεί το υπάρχον εργαλείο;')}</strong>
                      <div className="prep-source-buttons">
                        <button
                          type="button"
                          className={prepOutgoingDestination === 'SERVICE' ? 'active' : ''}
                          onClick={() => {
                            setPrepOutgoingDestination('SERVICE');
                            setPrepOutgoingSetId('');
                          }}
                        >
                          Service
                        </button>
                        <button
                          type="button"
                          className={prepOutgoingDestination === 'STOCK' ? 'active' : ''}
                          onClick={() => {
                            setPrepOutgoingDestination('STOCK');
                            setPrepOutgoingSetId('');
                          }}
                        >
                          {tr('Απόθεμα')}
                        </button>
                        <button
                          type="button"
                          className={prepOutgoingDestination === 'SET' ? 'active' : ''}
                          onClick={() => setPrepOutgoingDestination('SET')}
                        >
                          {tr('Άλλο Set')}
                        </button>
                      </div>
                      {prepOutgoingDestination === 'SET' && (
                        <label>
                          {tr('Set προορισμού')}
                          <select value={prepOutgoingSetId} onChange={e => setPrepOutgoingSetId(e.target.value)}>
                            <option value="">{tr('Επιλογή Set…')}</option>
                            {prepOtherSets.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.barcode} · {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    <div className="prep-replace-step">
                      <span>2</span>
                      <div>
                        <strong>{tr('Εργαλείο αντικατάστασης')}</strong>
                        <small>{tr('Επίλεξε πηγή και φυσικό εργαλείο.')}</small>
                      </div>
                    </div>
                  </div>
                )}
                <div className="prep-replace-source">
                  <strong>{tr('Από πού θα γίνει η αντικατάσταση;')}</strong>
                  <div className="prep-source-buttons">
                    <button
                      type="button"
                      className={prepReplacementSource === 'STOCK' ? 'active' : ''}
                      onClick={() => {
                        setPrepReplacementSource('STOCK');
                        setPrepReplacementSetId('');
                        setPrepReplacementId('');
                      }}
                    >
                      {tr('Απόθεμα')}
                    </button>
                    <button
                      type="button"
                      className={prepReplacementSource === 'SET' ? 'active' : ''}
                      onClick={() => {
                        setPrepReplacementSource('SET');
                        setPrepReplacementSetId('');
                        setPrepReplacementId('');
                      }}
                    >
                      {tr('Άλλο Set')}
                    </button>
                    <button
                      type="button"
                      className={prepReplacementSource === 'STANDALONE' ? 'active' : ''}
                      onClick={() => {
                        setPrepReplacementSource('STANDALONE');
                        setPrepReplacementSetId('');
                        setPrepReplacementId('');
                      }}
                    >
                      {tr('Μεμονωμένο σε χρήση')}
                    </button>
                  </div>
                </div>
                {prepReplacementSource === 'SET' && (
                  <label>
                    {tr('1. Επιλογή Set')}
                    <select
                      value={prepReplacementSetId}
                      onChange={e => {
                        setPrepReplacementSetId(e.target.value);
                        setPrepReplacementId('');
                      }}
                    >
                      <option value="">{tr('Επιλογή Set…')}</option>
                      {prepReplacementSourceSets.map(set => (
                        <option key={set.id} value={set.id}>
                          {set.barcode} · {set.name} ·{' '}
                          {tools.filter(t => t.mode === 'SET_MEMBER' && t.setId === set.id).length} {tr('εργαλεία')}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  {prepReplacementSource === 'SET' ? tr('2. Επιλογή εργαλείου') : tr('Εργαλείο αντικατάστασης')}
                  <select
                    value={prepReplacementId}
                    disabled={prepReplacementSource === 'SET' && !prepReplacementSetId}
                    onChange={e => setPrepReplacementId(e.target.value)}
                  >
                    <option value="">{tr('Επιλογή εργαλείου…')}</option>
                    {prepReplacementCandidates.map(t => {
                      const sourceSet = t.setId ? sets.find(s => s.id === t.setId) : undefined;
                      const source =
                        prepReplacementSource === 'STOCK'
                          ? 'Απόθεμα'
                          : prepReplacementSource === 'SET'
                            ? `Set ${sourceSet?.barcode || '—'} · ${sourceSet?.name || ''}`
                            : `${t.department || 'Τμήμα'} · μεμονωμένο`;
                      return (
                        <option key={t.id} value={t.id}>
                          {t.code === prepReplacementTargetCode ? '★ ' : ''}
                          {t.barcode} · {t.name} · {source}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <div className="prep-replacement-note">
                  <CheckCircle2 size={15} />
                  <span>
                    {prepSelectedTool
                      ? tr(
                          'Με την επιβεβαίωση γίνονται ταυτόχρονα η έξοδος του υπάρχοντος εργαλείου και η είσοδος του νέου στο Set.',
                        )
                      : tr(
                          'Με την επιβεβαίωση το επιλεγμένο φυσικό εργαλείο προστίθεται στο Set και καλύπτει την έλλειψη.',
                        )}
                  </span>
                </div>
                {(() => {
                  const replacement = tools.find(t => t.id === prepReplacementId);
                  const sourceSet = replacement?.setId ? sets.find(s => s.id === replacement.setId) : undefined;
                  return replacement?.mode === 'SET_MEMBER' && sourceSet ? (
                    <div className="prep-block-warning">
                      <TriangleAlert size={16} />
                      <span>
                        {tr('Θα αφαιρεθεί από το Set') + ' '}
                        {sourceSet.barcode}
                        {tr(', το οποίο θα μείνει με έλλειψη.')}
                      </span>
                    </div>
                  ) : null;
                })()}
              </>
            )}
            {prepToolAction === 'SET' && (
              <label>
                {tr('Set προορισμού')}
                <select value={prepTargetSetId} onChange={e => setPrepTargetSetId(e.target.value)}>
                  <option value="">{tr('Επιλογή Set…')}</option>
                  {prepOtherSets.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.barcode} · {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="modal-actions">
              <button onClick={closePrepToolAction}>{tr('Ακύρωση')}</button>
              <button
                className="primary"
                disabled={
                  (prepToolAction === 'REPLACE' &&
                    (!prepReplacementId ||
                      (!!prepSelectedTool && prepOutgoingDestination === 'SET' && !prepOutgoingSetId))) ||
                  (prepToolAction === 'SET' && !prepTargetSetId)
                }
                onClick={applyPrepToolAction}
              >
                {prepToolAction === 'REPLACE'
                  ? prepSelectedTool
                    ? tr('Επιβεβαίωση αντικατάστασης')
                    : tr('Επιβεβαίωση κάλυψης έλλειψης')
                  : prepToolAction === 'SERVICE'
                    ? tr('Μεταφορά στα Χαλασμένα / Service')
                    : prepToolAction === 'STOCK'
                      ? tr('Μεταφορά στο Απόθεμα')
                      : tr('Μεταφορά σε άλλο Set')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
