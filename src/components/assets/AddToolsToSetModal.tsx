import {useMemo, useState} from 'react';
import {Box, Check, Layers3, PackageOpen, Stethoscope, X} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import AppButton from '../ui/AppButton';
import AssetFilterBar from './AssetFilterBar';
import {tr, trData} from '../../i18n';
import {useSetColorQuestion} from './useSetColorQuestion';

type Source = 'STOCK' | 'SET_MEMBER' | 'STANDALONE';

export default function AddToolsToSetModal({setId, onClose}: {setId: string; onClose: () => void}) {
  const {tools, sets, addToolsToSet, applyColorPlan} = useSurgi();
  const colorQuestion = useSetColorQuestion();
  const [source, setSource] = useState<Source>('STOCK');
  const [q, setQ] = useState('');
  const [department, setDepartment] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const target = sets.find(s => s.id === setId);
  const members = tools.filter(t => t.setId === setId);
  const sourceTools = useMemo(() => tools.filter(t => t.setId !== setId && t.mode === source), [tools, source, setId]);
  const values = (key: 'department' | 'specialty' | 'manufacturer') =>
    [...new Set(sourceTools.map(t => String(t[key] || '')).filter(Boolean))].sort();
  const candidates = useMemo(
    () =>
      sourceTools.filter(
        t =>
          (!department || t.department === department) &&
          (!specialty || t.specialty === specialty) &&
          (!manufacturer || t.manufacturer === manufacturer) &&
          `${t.barcode} ${t.name} ${t.code} ${t.manufacturer} ${t.specialty} ${t.department || ''}`
            .toLowerCase()
            .includes(q.toLowerCase()),
      ),
    [sourceTools, q, department, specialty, manufacturer],
  );
  const label = tr(
    source === 'STOCK' ? 'Stock εργαλείων' : source === 'SET_MEMBER' ? 'άλλα Σετ' : 'Μεμονωμένα σε χρήση',
  );
  const sourceCount = (value: Source) => tools.filter(t => t.setId !== setId && t.mode === value).length;
  const chooseSource = (value: Source) => {
    setSource(value);
    setSelected([]);
    setQ('');
    setDepartment('');
    setSpecialty('');
    setManufacturer('');
  };
  return (
    <>
      <div
        className="modal-backdrop asset-modal-backdrop-workspace"
        onMouseDown={e => e.currentTarget === e.target && onClose()}
      >
        <div
          className="asset-modal asset-modal-add-tools"
          role="dialog"
          aria-modal="true"
          aria-label={tr('Προσθήκη εργαλείων στο Σετ')}
        >
          <header className="add-tools-profile-head">
            <div className="asset-profile-icon">
              <Box size={22} />
            </div>
            <div className="asset-profile-title">
              <span className="eyebrow">{tr('ΣΥΝΘΕΣΗ ΣΕΤ')}</span>
              <h2>{tr('Προσθήκη εργαλείων')}</h2>
              <p>
                <b>{target?.name || tr('Σετ')}</b> {tr('· Κωδικός:') + ' '}
                {target?.code || '—'} · Barcode: <span className="mono">{target?.barcode || '—'}</span>
              </p>
            </div>
            <button className="icon-button" onClick={onClose} aria-label={tr('Κλείσιμο')}>
              <X size={18} />
            </button>
          </header>
          <div className="add-tools-summary">
            <div>
              <Layers3 size={16} />
              <span>{tr('Τρέχουσα σύνθεση')}</span>
              <strong>
                {members.length}/{target?.expected || members.length}
              </strong>
            </div>
            <div>
              <PackageOpen size={16} />
              <span>{tr('Διαθέσιμα στην πηγή')}</span>
              <strong>{candidates.length}</strong>
            </div>
            <div>
              <Check size={16} />
              <span>{tr('Επιλεγμένα')}</span>
              <strong>{selected.length}</strong>
            </div>
          </div>
          <div className="modal-body add-tools-body">
            <div className="source-tabs source-tabs-spacious" role="tablist" aria-label={tr('Πηγή εργαλείων')}>
              <button className={source === 'STOCK' ? 'active' : ''} onClick={() => chooseSource('STOCK')}>
                <PackageOpen size={15} /> Stock <span>{sourceCount('STOCK')}</span>
              </button>
              <button className={source === 'SET_MEMBER' ? 'active' : ''} onClick={() => chooseSource('SET_MEMBER')}>
                <Layers3 size={15} /> {tr('Από άλλο Σετ') + ' '}
                <span>{sourceCount('SET_MEMBER')}</span>
              </button>
              <button className={source === 'STANDALONE' ? 'active' : ''} onClick={() => chooseSource('STANDALONE')}>
                <Stethoscope size={15} /> {tr('Μεμονωμένα σε χρήση') + ' '}
                <span>{sourceCount('STANDALONE')}</span>
              </button>
            </div>
            <AssetFilterBar
              compact
              query={q}
              onQueryChange={setQ}
              placeholder={tr('Εργαλείο, κωδικός ή barcode σε {0}...', label)}
              filters={[
                {
                  key: 'department',
                  value: department,
                  placeholder: tr('Όλα τα τμήματα'),
                  options: values('department').map(value => ({value, label: value})),
                  onChange: setDepartment,
                },
                {
                  key: 'specialty',
                  value: specialty,
                  placeholder: tr('Όλες οι ειδικότητες'),
                  options: values('specialty').map(value => ({value, label: value})),
                  onChange: setSpecialty,
                },
                {
                  key: 'manufacturer',
                  value: manufacturer,
                  placeholder: tr('Όλες οι εταιρείες'),
                  options: values('manufacturer').map(value => ({value, label: value})),
                  onChange: setManufacturer,
                },
              ]}
            />
            <div className="composer-list composer-list-workspace">
              {candidates.map(t => {
                const active = selected.includes(t.id);
                const set = sets.find(s => s.id === t.setId);
                return (
                  <button
                    type="button"
                    className={`composer-row composer-row-roomy ${active ? 'selected' : ''}`}
                    key={t.id}
                    onClick={() => setSelected(v => (active ? v.filter(id => id !== t.id) : [...v, t.id]))}
                  >
                    <span className="select-mark">{active && <Check size={14} />}</span>
                    <span>
                      <b className="mono">{t.barcode}</b>
                      <small>{t.code}</small>
                    </span>
                    <span>
                      <b>{t.name}</b>
                      <small>
                        {t.manufacturer} · {trData(t.specialty) || tr('Χωρίς ειδικότητα')}
                      </small>
                    </span>
                    <span className="source-pill">
                      {source === 'SET_MEMBER'
                        ? tr('{0} · {1}', set?.barcode || 'Σετ', set?.name || '')
                        : source === 'STANDALONE'
                          ? t.department || '—'
                          : 'Stock'}
                    </span>
                  </button>
                );
              })}
              {!candidates.length && (
                <div className="empty-inline">{tr('Δεν υπάρχουν διαθέσιμα εργαλεία σε αυτή την πηγή.')}</div>
              )}
            </div>
          </div>
          <footer className="asset-modal-footer-sticky">
            <span className="selection-count">
              {selected.length} {tr('επιλεγμένα')}
            </span>
            <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
            <AppButton variant="primary" disabled={!selected.length} onClick={() => setConfirm(true)}>
              {tr('Προσθήκη στο Σετ')}
            </AppButton>
          </footer>
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          title={tr('Προσθήκη εργαλείων στο Σετ;')}
          message={tr(
            'Θα μετακινηθούν {0} φυσικά εργαλεία στο {1}. Η προηγούμενη θέση τους θα καταγραφεί στο ιστορικό.',
            selected.length,
            target?.barcode,
          )}
          confirmLabel={tr('Ναι, προσθήκη')}
          onConfirm={async () => {
            const plan = await colorQuestion.ask(selected, setId);
            if (!plan) return;
            addToolsToSet(setId, selected);
            applyColorPlan(plan, sets.find(s => s.id === setId)?.barcode || '');
            onClose();
          }}
          onClose={() => setConfirm(false)}
        />
      )}
      {colorQuestion.dialog}
    </>
  );
}
