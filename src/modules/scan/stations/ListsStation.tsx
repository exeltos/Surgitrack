import {useState} from 'react';
import {ChevronRight, Search} from 'lucide-react';
import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import {statusLabel} from '../../../components/ui/statusLabel';
import {formatDate} from '../../../core/displayDate';
import {tr, trData} from '../../../i18n';
import {useSurgi} from '../../../store/SurgiStore';
import {ScanScreen, SetContents} from '../ScanParts';

type Tab = 'SETS' | 'TOOLS';
/** Rows shown at first; «Περισσότερα» shows the next as many. */
const PAGE = 60;

/**
 * Lists to look at, nothing to change: the Sets and the standalone instruments, with a search; a Set opens
 * what it holds. A department user sees only their own department's, as everywhere in the app.
 */
export default function ListsStation({onStations}: {onStations: () => void}) {
  const {sets, tools, role, currentUser} = useSurgi();
  const [tab, setTab] = useState<Tab>('SETS');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<{kind: 'SET' | 'TOOL'; id: string} | null>(null);
  const own = (department: string | undefined) => role !== 'DEPARTMENT' || department === currentUser.department;
  const needle = query.trim().toLowerCase();
  const matches = (item: {barcode: string; name: string; code: string}) =>
    !needle || [item.barcode, item.name, item.code].some(text => text.toLowerCase().includes(needle));
  const setRows = sets.filter(item => own(item.department) && matches(item));
  const toolRows = tools.filter(
    item => item.mode === 'STANDALONE' && item.state !== 'RETIRED' && own(item.department) && matches(item),
  );
  const rows = tab === 'SETS' ? setRows : toolRows;

  const set = open?.kind === 'SET' ? sets.find(item => item.id === open.id) : undefined;
  const tool = open?.kind === 'TOOL' ? tools.find(item => item.id === open.id) : undefined;
  const asset = set || tool;
  if (asset && open) {
    const members = set ? tools.filter(item => item.setId === set.id) : [];
    return (
      <ScanScreen
        title={asset.name}
        subtitle={<span className="mono">{asset.barcode}</span>}
        backLabel={tr('Λίστες')}
        onBack={() => setOpen(null)}
      >
        <dl className="scan-summary">
          <div>
            <dt>{tr('Κατάσταση')}</dt>
            <dd>{statusLabel(asset.state)}</dd>
          </div>
          <div>
            <dt>{tr('Τμήμα')}</dt>
            <dd>{trData(asset.department) || tr('Χωρίς τμήμα')}</dd>
          </div>
          {asset.specialty && (
            <div>
              <dt>{tr('Ειδικότητα')}</dt>
              <dd>{trData(asset.specialty)}</dd>
            </div>
          )}
          {set && (
            <div>
              <dt>{tr('Εργαλεία')}</dt>
              <dd>{members.length}</dd>
            </div>
          )}
          {asset.sterileUntil && (
            <div>
              <dt>{tr('Αποστειρωμένο έως')}</dt>
              <dd>{formatDate(asset.sterileUntil)}</dd>
            </div>
          )}
        </dl>
        {set && <SetContents tools={members} />}
      </ScanScreen>
    );
  }

  return (
    <ScanScreen
      title={tr('Λίστες')}
      subtitle={tr('Σετ και μεμονωμένα εργαλεία')}
      backLabel={tr('Σταθμοί')}
      onBack={onStations}
    >
      <div className="scan-camera-tools" role="group" aria-label={tr('Λίστα')}>
        {(
          [
            ['SETS', tr('Σετ'), setRows.length],
            ['TOOLS', tr('Μεμονωμένα'), toolRows.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              setShown(PAGE);
            }}
          >
            {label} · {count}
          </button>
        ))}
      </div>
      <label className="scan-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          placeholder={tr('Barcode, όνομα ή κωδικός')}
          aria-label={tr('Αναζήτηση')}
        />
      </label>
      {rows.length ? (
        <ul className="scan-loads">
          {rows.slice(0, shown).map(item => (
            <li key={item.id}>
              <button type="button" onClick={() => setOpen({kind: tab === 'SETS' ? 'SET' : 'TOOL', id: item.id})}>
                <AssetTypeIcon kind={tab === 'SETS' ? 'SET' : 'TOOL'} size={18} />
                <span>
                  <b>{item.name}</b>
                  <small>
                    <span className="mono">{item.barcode}</span> · {statusLabel(item.state)}
                    {role !== 'DEPARTMENT' && item.department ? ` · ${trData(item.department)}` : ''}
                  </small>
                </span>
                <ChevronRight size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="scan-empty">{tr('Δεν βρέθηκε τίποτα.')}</p>
      )}
      {rows.length > shown && (
        <button type="button" className="scan-secondary" onClick={() => setShown(n => n + PAGE)}>
          {tr('Περισσότερα · {0}', rows.length - shown)}
        </button>
      )}
    </ScanScreen>
  );
}
