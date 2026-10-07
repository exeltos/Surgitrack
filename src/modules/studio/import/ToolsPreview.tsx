import {useMemo, useState} from 'react';
import {Search} from 'lucide-react';
import type {ImportPlan} from '../assetImport';

const PREVIEW_ROWS = 200;

export default function ToolsPreview({plan, L}: {plan: ImportPlan; L: (el: string, en: string) => string}) {
  const [query, setQuery] = useState('');
  const setNames = useMemo(() => new Map(plan.sets.map(s => [s.id, `${s.barcode} · ${s.name}`])), [plan.sets]);
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      plan.tools.filter(
        t =>
          !q ||
          `${t.barcode} ${t.name} ${t.code} ${t.manufacturer || ''} ${t.department || ''} ${
            t.setId ? setNames.get(t.setId) || '' : ''
          }`
            .toLowerCase()
            .includes(q),
      ),
    [plan.tools, q, setNames],
  );
  if (!plan.tools.length) return null;
  return (
    <section className="asset-import-tools">
      <header>
        <b>
          {L(`Εργαλεία που θα δημιουργηθούν (${plan.tools.length})`, `Instruments to create (${plan.tools.length})`)}
        </b>
        <label className="asset-import-tools-search">
          <Search size={15} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={L('Αναζήτηση ονομασίας, κωδικού, κατασκευαστή…', 'Search name, code, manufacturer…')}
          />
        </label>
      </header>
      <div className="asset-import-tools-table">
        <table>
          <thead>
            <tr>
              <th>Barcode</th>
              <th>{L('Ονομασία', 'Name')}</th>
              <th>{L('Κωδικός', 'Code')}</th>
              <th>{L('Κατασκευαστής', 'Manufacturer')}</th>
              <th>{L('Θέση', 'Place')}</th>
              <th>{L('Όριο χρήσεων', 'Use limit')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, PREVIEW_ROWS).map(t => (
              <tr key={t.id}>
                <td className="mono">{t.barcode}</td>
                <td>{t.name}</td>
                <td>{t.code || '—'}</td>
                <td>{t.manufacturer || '—'}</td>
                <td>{t.setId ? setNames.get(t.setId) || L('Σετ', 'Set') : t.department || L('Απόθεμα', 'Stock')}</td>
                <td>{t.maxUses || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small>
        {shown.length > PREVIEW_ROWS
          ? L(
              `Εμφανίζονται ${PREVIEW_ROWS} από ${shown.length}. Χρησιμοποιήστε την αναζήτηση για τα υπόλοιπα.`,
              `Showing ${PREVIEW_ROWS} of ${shown.length}. Use the search for the rest.`,
            )
          : !shown.length
            ? L('Κανένα εργαλείο δεν ταιριάζει στην αναζήτηση.', 'No instrument matches the search.')
            : L(`${shown.length} εργαλεία.`, `${shown.length} instruments.`)}
      </small>
    </section>
  );
}
