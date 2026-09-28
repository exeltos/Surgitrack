import {useMemo, useState, type ReactNode} from 'react';
import {ArrowRightLeft, CircleCheck, Layers3, PackageOpen, SearchX, Unlink, Wrench, X} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {useSurgi} from '../../store/SurgiStore';
import {tr} from '../../i18n';
import type {SetAsset, Tool} from '../../types/domain';

type ToolAction = 'MOVE' | 'REMOVE' | 'STOCK' | 'SERVICE' | 'LOST' | 'RETURN';
type SetAction = 'SERVICE' | 'LOST' | 'RETURN';
type Choice<T> = {id: T; icon: ReactNode; title: string; hint: string; danger?: boolean};

/**
 * Management of one instrument or Set by the hospital admin or the sterilization supervisor:
 * move between Sets, back to stock, service, lost / found. Every change is written to the history.
 */
export default function AssetManageModal({
  kind,
  asset,
  onClose,
}: {
  kind: 'TOOL' | 'SET';
  asset: Tool | SetAsset;
  onClose: () => void;
}) {
  const {sets, moveTool, markLost, returnToService, sendSetToService} = useSurgi();
  const tool = kind === 'TOOL' ? (asset as Tool) : undefined;
  const out = asset.state === 'LOST' || asset.state === 'SERVICE';
  const inSet = tool?.mode === 'SET_MEMBER' && !!tool.setId;
  // A member of a Set that is itself lost or in service follows its Set: it is managed there.
  const parentSet = tool?.setId ? sets.find(s => s.id === tool.setId) : undefined;
  const followsSet = !!parentSet && (parentSet.state === 'LOST' || parentSet.state === 'SERVICE');

  const toolChoices: Array<Choice<ToolAction>> = out
    ? [
        {
          id: 'RETURN',
          icon: <CircleCheck size={18} />,
          title: asset.state === 'LOST' ? tr('Βρέθηκε · επιστροφή στο Stock') : tr('Επιστροφή από Service στο Stock'),
          hint: tr('Το εργαλείο ξαναμπαίνει σε χρήση και μπορεί να μπει σε Σετ.'),
        },
      ]
    : [
        {
          id: 'MOVE',
          icon: <ArrowRightLeft size={18} />,
          title: inSet ? tr('Μετακίνηση σε άλλο Σετ') : tr('Τοποθέτηση σε Σετ'),
          hint: tr('Το εργαλείο φεύγει από το τωρινό του Σετ και μπαίνει στο νέο.'),
        },
        ...(inSet
          ? [
              {
                id: 'REMOVE' as const,
                icon: <Unlink size={18} />,
                title: tr('Αφαίρεση από το Σετ ως μεμονωμένο'),
                hint: tr('Μένει στο ίδιο τμήμα ως μεμονωμένο εργαλείο.'),
              },
            ]
          : []),
        ...(tool?.mode !== 'STOCK'
          ? [
              {
                id: 'STOCK' as const,
                icon: <PackageOpen size={18} />,
                title: tr('Επιστροφή στο Stock'),
                hint: tr('Διαθέσιμο για αντικατάσταση ή για νέο Σετ.'),
              },
            ]
          : []),
        {
          id: 'SERVICE',
          icon: <Wrench size={18} />,
          title: tr('Αποστολή σε Service'),
          hint: tr('Για επισκευή ή έλεγχο· ανοίγει εκκρεμότητα.'),
        },
        {
          id: 'LOST',
          icon: <SearchX size={18} />,
          title: tr('Δήλωση απώλειας'),
          hint: tr('Το εργαλείο δεν βρίσκεται· ανοίγει εκκρεμότητα απώλειας.'),
          danger: true,
        },
      ];
  const setChoices: Array<Choice<SetAction>> = out
    ? [
        {
          id: 'RETURN',
          icon: <CircleCheck size={18} />,
          title: asset.state === 'LOST' ? tr('Βρέθηκε · επιστροφή σε χρήση') : tr('Επιστροφή από Service'),
          hint: tr('Το Σετ ξαναμπαίνει σε χρήση στο τμήμα του.'),
        },
      ]
    : [
        {
          id: 'SERVICE',
          icon: <Wrench size={18} />,
          title: tr('Αποστολή Σετ σε Service'),
          hint: tr('Όλο το Σετ βγαίνει από την κυκλοφορία για επισκευή ή έλεγχο.'),
        },
        {
          id: 'LOST',
          icon: <SearchX size={18} />,
          title: tr('Δήλωση απώλειας Σετ'),
          hint: tr('Το Σετ δεν βρίσκεται· ανοίγει εκκρεμότητα απώλειας.'),
          danger: true,
        },
      ];
  const choices: Array<Choice<ToolAction | SetAction>> = kind === 'TOOL' ? toolChoices : setChoices;

  const [action, setAction] = useState<ToolAction | SetAction>(choices[0].id);
  const [targetSetId, setTargetSetId] = useState('');
  const [setQuery, setSetQuery] = useState('');
  const [note, setNote] = useState('');
  const targets = useMemo(
    () =>
      sets
        // Only Sets that can change composition: not in a reprocessing cycle, not out of use.
        .filter(s => s.id !== tool?.setId && (s.state === 'IN_DEPARTMENT' || s.state === 'IN_STOCK'))
        .filter(s => `${s.barcode} ${s.name} ${s.department}`.toLowerCase().includes(setQuery.toLowerCase())),
    [sets, tool?.setId, setQuery],
  );
  const needsNote = action === 'LOST' || action === 'SERVICE';
  const ready = action === 'MOVE' ? !!targetSetId : !needsNote || note.trim().length > 0;

  const confirm = () => {
    if (!ready || followsSet) return;
    if (kind === 'TOOL') {
      if (action === 'MOVE') moveTool(asset.id, 'SET', targetSetId);
      else if (action === 'REMOVE') moveTool(asset.id, 'REMOVE');
      else if (action === 'STOCK') moveTool(asset.id, 'STOCK');
      else if (action === 'SERVICE') moveTool(asset.id, 'SERVICE', undefined, note.trim());
      else if (action === 'LOST') markLost('TOOL', asset.id, note.trim());
      else returnToService('TOOL', asset.id, note.trim());
    } else if (action === 'SERVICE') sendSetToService(asset.id, note.trim());
    else if (action === 'LOST') markLost('SET', asset.id, note.trim());
    else returnToService('SET', asset.id, note.trim());
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <div className="asset-manage-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <span className="eyebrow">{kind === 'TOOL' ? tr('ΔΙΑΧΕΙΡΙΣΗ ΕΡΓΑΛΕΙΟΥ') : tr('ΔΙΑΧΕΙΡΙΣΗ ΣΕΤ')}</span>
            <h2>
              <span className="mono">{asset.barcode}</span> · {asset.name}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={tr('Κλείσιμο')}>
            <X size={18} />
          </button>
        </header>
        {followsSet && parentSet && (
          <p className="asset-manage-follows">
            {tr(
              'Το εργαλείο ακολουθεί το Σετ {0}, που είναι εκτός χρήσης. Η επιστροφή γίνεται από τη διαχείριση του Σετ.',
              parentSet.barcode,
            )}
          </p>
        )}
        <div className="asset-manage-choices" hidden={followsSet}>
          {choices.map(choice => (
            <button
              key={choice.id}
              type="button"
              className={`${action === choice.id ? 'active' : ''} ${choice.danger ? 'danger' : ''}`}
              onClick={() => setAction(choice.id)}
            >
              {choice.icon}
              <span>
                <b>{choice.title}</b>
                <small>{choice.hint}</small>
              </span>
            </button>
          ))}
        </div>
        {!followsSet && action === 'MOVE' && (
          <div className="asset-manage-target">
            <label>
              <Layers3 size={16} />
              <input
                value={setQuery}
                onChange={e => setSetQuery(e.target.value)}
                placeholder={tr('Αναζήτηση Σετ με barcode, όνομα ή τμήμα...')}
              />
            </label>
            <div className="asset-manage-sets">
              {targets.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={targetSetId === s.id ? 'active' : ''}
                  onClick={() => setTargetSetId(s.id)}
                >
                  <b className="mono">{s.barcode}</b>
                  <span>{s.name}</span>
                  <small>{s.department || 'Stock'}</small>
                </button>
              ))}
              {targets.length === 0 && <p>{tr('Δεν βρέθηκαν Σετ.')}</p>}
            </div>
          </div>
        )}
        {!followsSet && action !== 'MOVE' && (
          <label className="asset-manage-note">
            <span>{needsNote ? tr('Αιτιολογία (υποχρεωτική)') : tr('Σημείωση (προαιρετική)')}</span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder={
                action === 'LOST'
                  ? tr('Πού και πότε εντοπίστηκε η απώλεια...')
                  : action === 'SERVICE'
                    ? tr('Τι πρόβλημα έχει...')
                    : ''
              }
            />
          </label>
        )}
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton variant="primary" disabled={!ready || followsSet} onClick={confirm}>
            {tr('Καταχώρηση')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
