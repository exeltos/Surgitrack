import {useMemo, useRef, useState, type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {Layers3, PackageOpen, Search, ShoppingCart, Wrench} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {useSurgi} from '../../store/SurgiStore';
import {inActiveProcess, isMovable, kindKey} from '../../core/replacements';
import {tr, trData} from '../../i18n';
import {useSetColorQuestion} from './useSetColorQuestion';
import type {Tool} from '../../types/domain';

type Source = 'STOCK' | 'SET' | 'STANDALONE';

/**
 * Replacing one instrument right where its report is: the same instrument in Stock, in another Set or loose in a
 * department, and which one goes into its Set. The instrument replaced goes to Service. With nothing to take it
 * from, the purchase order is one step away.
 */
export default function ReplaceToolModal({tool, onClose}: {tool: Tool; onClose: () => void}) {
  const store = useSurgi();
  const {tools, sets} = store;
  const colorQuestion = useSetColorQuestion();
  // The store as it is when the step is confirmed (after the color question), not when it was opened: another
  // workstation may have started a process meanwhile.
  const latest = useRef(store);
  latest.current = store;
  const target = tool.setId ? sets.find(s => s.id === tool.setId) : undefined;
  const kind = kindKey(tool);
  const setsById = useMemo(() => new Map(sets.map(s => [s.id, s])), [sets]);
  // Where each usable instrument is now; one in Service, lost, out of use or in an active process (washing,
  // sterilization, on its way) replaces nothing.
  const sourceOf = (t: Tool): Source | undefined =>
    t.id === tool.id || !isMovable(t)
      ? undefined
      : t.mode === 'STOCK'
        ? 'STOCK'
        : t.mode === 'SET_MEMBER'
          ? t.setId && t.setId !== tool.setId
            ? 'SET'
            : undefined
          : 'STANDALONE';
  const same = useMemo(() => tools.filter(t => kindKey(t) === kind && sourceOf(t)), [tools, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const countOf = (source: Source) => same.filter(t => sourceOf(t) === source).length;
  const [source, setSource] = useState<Source>(() =>
    countOf('STOCK') ? 'STOCK' : countOf('SET') ? 'SET' : countOf('STANDALONE') ? 'STANDALONE' : 'STOCK',
  );
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState('');
  const q = query.trim().toLowerCase();
  // The same instrument first; a search finds any other that can stand in for it.
  const shown = (
    q
      ? tools.filter(
          t =>
            sourceOf(t) === source &&
            `${t.barcode} ${t.name} ${t.code || ''} ${t.setId ? setsById.get(t.setId)?.barcode || '' : ''}`
              .toLowerCase()
              .includes(q),
        )
      : same.filter(t => sourceOf(t) === source)
  ).slice(0, 60);
  const choice = tools.find(t => t.id === picked);
  const from = choice?.setId ? setsById.get(choice.setId) : undefined;

  // The instrument replaced and its Set must be out of any active process too.
  const open = !!target && !inActiveProcess(tool) && !inActiveProcess(target);
  const confirm = async () => {
    if (!target || !choice || !open) return;
    const plan = await colorQuestion.ask([choice.id], target.id);
    if (!plan) return;
    // Checked again on the current data: the donor, the instrument replaced and its Set.
    const now = latest.current;
    const donor = now.tools.find(t => t.id === choice.id);
    const outgoing = now.tools.find(t => t.id === tool.id);
    const set = now.sets.find(s => s.id === target.id);
    if (!donor || !sourceOf(donor) || !outgoing || !set || outgoing.setId !== set.id) return onClose();
    if (inActiveProcess(outgoing) || inActiveProcess(set)) return onClose();
    if (sourceOf(donor) === 'STOCK')
      now.replaceFromStock([{toolId: outgoing.id, stockToolId: donor.id, setId: set.id}]);
    else now.replaceToolInSet(set.id, outgoing.id, donor.id, 'SERVICE');
    now.applyColorPlan(plan, set.barcode);
    onClose();
  };

  const tabs: Array<{id: Source; label: string; icon: ReactNode}> = [
    {id: 'STOCK', label: tr('Απόθεμα'), icon: <PackageOpen size={15} />},
    {id: 'SET', label: tr('Άλλο Σετ'), icon: <Layers3 size={15} />},
    {id: 'STANDALONE', label: tr('Μεμονωμένο'), icon: <Wrench size={15} />},
  ];

  return (
    <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <div className="asset-manage-modal replace-tool-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <span className="eyebrow">{tr('Αντικατάσταση')}</span>
            <h2>
              <span className="mono">{tool.barcode}</span> · {tool.name}
            </h2>
            <small>
              {target
                ? tr('Στο Σετ {0} · το εργαλείο που φεύγει πάει σε Service.', `${target.barcode} · ${target.name}`)
                : tr('Δεν ανήκει σε Σετ· εδώ φαίνεται μόνο πού υπάρχει ίδιο εργαλείο.')}
            </small>
          </div>
        </header>
        <div className="name-check-tabs replace-tool-sources" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={source === tab.id}
              className={source === tab.id ? 'active' : ''}
              onClick={() => (setSource(tab.id), setPicked(''))}
            >
              {tab.icon} {tab.label} <b>{countOf(tab.id)}</b>
            </button>
          ))}
        </div>
        <label className="replace-tool-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={tr('Άλλο εργαλείο: barcode, όνομα ή κωδικός…')}
          />
        </label>
        <ul className="replace-tool-list">
          {shown.map(t => {
            const set = t.setId ? setsById.get(t.setId) : undefined;
            return (
              <li key={t.id}>
                <label className={picked === t.id ? 'active' : ''}>
                  <input
                    type="radio"
                    name="replacement"
                    checked={picked === t.id}
                    disabled={!open}
                    onChange={() => setPicked(t.id)}
                  />
                  <span className="mono">{t.barcode}</span>
                  <span>{t.name}</span>
                  <small>
                    {source === 'STOCK'
                      ? tr('Απόθεμα')
                      : source === 'SET'
                        ? `${set?.barcode || ''} · ${trData(set?.department || '')}`
                        : trData(t.department || '')}
                  </small>
                </label>
              </li>
            );
          })}
          {!shown.length && (
            <li className="replace-tool-none">
              {q
                ? tr('Δεν βρέθηκε εργαλείο.')
                : source === 'STOCK'
                  ? tr('Δεν υπάρχει ίδιο εργαλείο στο Απόθεμα.')
                  : source === 'SET'
                    ? tr('Δεν υπάρχει ίδιο εργαλείο σε άλλο Σετ.')
                    : tr('Δεν υπάρχει ίδιο μεμονωμένο εργαλείο.')}
            </li>
          )}
        </ul>
        {from && (
          <p className="replace-tool-warning">
            {tr('Θα αφαιρεθεί από το Σετ {0}, το οποίο θα μείνει με έλλειψη.', from.barcode)}
          </p>
        )}
        <footer>
          {!same.length && (
            <Link className="app-button app-button-secondary" to="/issues?tab=replacements" onClick={onClose}>
              <ShoppingCart size={15} aria-hidden="true" /> {tr('Παραγγελία αγοράς')}
            </Link>
          )}
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton variant="primary" disabled={!open || !choice} onClick={confirm}>
            {tr('Αντικατάσταση')}
          </AppButton>
        </footer>
      </div>
      {colorQuestion.dialog}
    </div>
  );
}
