import {createContext, useContext, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  ChevronRight,
  Search,
  SpellCheck2,
  Wand2,
  X,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import AppButton from '../../components/ui/AppButton';
import {useSurgi} from '../../store/SurgiStore';
import {cleanName, cleanUps, codeGroups, type CodeGroup} from '../../core/nameCheck';
import {tr, trData} from '../../i18n';
import {statusLabel} from '../../components/ui/statusLabel';

/** Opens the list of the instruments behind a count. */
const ShowTools = createContext<(ids: string[], title: string) => void>(() => {});

/** A count that opens its instruments. */
function CountButton({ids, title}: {ids: string[]; title: string}) {
  const show = useContext(ShowTools);
  return (
    <button
      type="button"
      className="name-check-count"
      title={tr('Εμφάνιση εργαλείων')}
      onClick={() => show(ids, title)}
    >
      {ids.length}
    </button>
  );
}

const PAGE = 40;

/**
 * Έλεγχος ονομασιών: the instruments' names made consistent. First the safe clean-up (spacing,
 * capitals, letters typed on the wrong keyboard, lengths), then each code whose instruments carry
 * different names, unified to the one chosen. Every change is one history entry and can be undone.
 */
export default function NameCheckPage() {
  const navigate = useNavigate();
  const {tools, sets, can, renameTools} = useSurgi();
  const [list, setList] = useState<{ids: string[]; title: string}>();
  const [tab, setTab] = useState<'CLEAN' | 'CODES'>('CLEAN');
  const fixes = useMemo(() => cleanUps(tools), [tools]);
  const groups = useMemo(() => codeGroups(tools), [tools]);
  const distinct = useMemo(() => new Set(tools.map(t => t.name)).size, [tools]);
  const odd = useMemo(() => groups.filter(g => g.names.some(n => n.odd)).length, [groups]);
  const editable = can('asset.edit');
  const currentName = useMemo(() => new Map(tools.map(t => [t.id, t.name])), [tools]);

  return (
    <ShowTools.Provider value={(ids, title) => setList({ids, title})}>
      <div className="name-check">
        <PageHeader
          eyebrow={tr('ΜΗΤΡΩΟ ΕΞΟΠΛΙΣΜΟΥ')}
          title={tr('Έλεγχος ονομασιών')}
          description={tr(
            'Ενιαίες ονομασίες για τα ίδια εργαλεία: πρώτα οι διορθώσεις γραφής, μετά οι κωδικοί με περισσότερες από μία ονομασίες. Κάθε αλλαγή γράφεται στο ιστορικό και αναιρείται.',
          )}
          actions={
            <AppButton icon={<ArrowLeft size={16} />} onClick={() => navigate('/tools')}>
              {tr('Εργαλεία')}
            </AppButton>
          }
        />
        <div className="name-check-kpis">
          <div>
            <span>{tr('Εργαλεία')}</span>
            <strong>{tools.length}</strong>
          </div>
          <div>
            <span>{tr('Διαφορετικές ονομασίες')}</span>
            <strong>{distinct}</strong>
          </div>
          <div className={fixes.length ? 'warn' : 'good'}>
            <span>{tr('Διορθώσεις γραφής')}</span>
            <strong>{fixes.length}</strong>
            <small>
              {tr(
                '{0} εργαλεία',
                fixes.reduce((sum, f) => sum + f.items.length, 0),
              )}
            </small>
          </div>
          <div className={groups.length ? 'warn' : 'good'}>
            <span>{tr('Κωδικοί με πολλές ονομασίες')}</span>
            <strong>{groups.length}</strong>
            <small>{tr('{0} με πιθανό λάθος κωδικό', odd)}</small>
          </div>
        </div>
        <div className="name-check-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'CLEAN'}
            className={tab === 'CLEAN' ? 'active' : ''}
            onClick={() => setTab('CLEAN')}
          >
            <Wand2 size={16} /> {tr('Διορθώσεις γραφής')} <b>{fixes.length}</b>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'CODES'}
            className={tab === 'CODES' ? 'active' : ''}
            onClick={() => setTab('CODES')}
          >
            <SpellCheck2 size={16} /> {tr('Ίδιος κωδικός, πολλές ονομασίες')} <b>{groups.length}</b>
          </button>
        </div>
        {tab === 'CLEAN' ? (
          <CleanUps fixes={fixes} editable={editable} onApply={renameTools} />
        ) : (
          <CodeGroups groups={groups} currentName={currentName} editable={editable} onApply={renameTools} />
        )}
      </div>
      {list && (
        <ToolsList ids={list.ids} title={list.title} tools={tools} sets={sets} onClose={() => setList(undefined)} />
      )}
    </ShowTools.Provider>
  );
}

type Apply = (changes: Array<{id: string; name: string}>, label: string) => void;

function CleanUps({fixes, editable, onApply}: {fixes: ReturnType<typeof cleanUps>; editable: boolean; onApply: Apply}) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE * 5);
  const chosen = fixes.filter(f => !skipped.has(f.from));
  const count = chosen.reduce((sum, f) => sum + f.items.length, 0);
  const toggle = (from: string) =>
    setSkipped(current => {
      const next = new Set(current);
      if (next.has(from)) next.delete(from);
      else next.add(from);
      return next;
    });
  if (!fixes.length)
    return (
      <div className="name-check-empty">
        <CheckCheck size={22} />
        <strong>{tr('Όλες οι ονομασίες είναι γραμμένες ενιαία.')}</strong>
      </div>
    );
  return (
    <section className="name-check-card">
      <header>
        <div>
          <b>{tr('Διορθώσεις χωρίς ρίσκο')}</b>
          <small>
            {tr(
              'Κενά, κεφαλαία χωρίς τόνους, γράμματα από λάθος πληκτρολόγιο (π.χ. λατινικό H σε ελληνική λέξη) και μονάδες (12cm → 12 CM). Το νόημα της ονομασίας δεν αλλάζει.',
            )}
          </small>
        </div>
        {editable && (
          <AppButton
            variant="primary"
            icon={<Wand2 size={15} />}
            disabled={!count}
            onClick={() =>
              onApply(
                chosen.flatMap(f => f.items.map(t => ({id: t.id, name: f.to}))),
                tr('Διορθώσεις γραφής σε {0} ονομασίες', chosen.length),
              )
            }
          >
            {tr('Εφαρμογή σε {0} εργαλεία', count)}
          </AppButton>
        )}
      </header>
      <div className="name-check-table">
        <table>
          <thead>
            <tr>
              {editable && <th />}
              <th>{tr('Σήμερα')}</th>
              <th />
              <th>{tr('Θα γίνει')}</th>
              <th>{tr('Εργαλεία')}</th>
            </tr>
          </thead>
          <tbody>
            {fixes.slice(0, shown).map(f => (
              <tr key={f.from} className={skipped.has(f.from) ? 'skipped' : ''}>
                {editable && (
                  <td>
                    <input type="checkbox" checked={!skipped.has(f.from)} onChange={() => toggle(f.from)} />
                  </td>
                )}
                <td className="from">{f.from}</td>
                <td className="arrow">
                  <ArrowRight size={14} />
                </td>
                <td className="to">{f.to}</td>
                <td className="num">
                  <CountButton ids={f.items.map(t => t.id)} title={f.from} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {fixes.length > shown && (
        <AppButton size="sm" onClick={() => setShown(n => n + PAGE * 5)}>
          {tr('Περισσότερες ({0} ακόμη)', fixes.length - shown)}
        </AppButton>
      )}
    </section>
  );
}

function CodeGroups({
  groups,
  currentName,
  editable,
  onApply,
}: {
  groups: CodeGroup[];
  currentName: Map<string, string>;
  editable: boolean;
  onApply: Apply;
}) {
  const [query, setQuery] = useState('');
  const [onlyOdd, setOnlyOdd] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const q = query.trim().toUpperCase();
  const list = groups.filter(
    g =>
      !hidden.has(g.code) &&
      (!onlyOdd || g.names.some(n => n.odd)) &&
      (!q || g.code.includes(q) || g.names.some(n => n.name.includes(cleanName(q)))),
  );
  return (
    <section className="name-check-codes">
      <div className="name-check-filter">
        <label className="name-check-search">
          <Search size={15} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={tr('Αναζήτηση κωδικού ή ονομασίας…')}
          />
        </label>
        <label className="name-check-only">
          <input type="checkbox" checked={onlyOdd} onChange={e => setOnlyOdd(e.target.checked)} />
          {tr('Μόνο με πιθανό λάθος κωδικό')}
        </label>
        <small>{tr('{0} κωδικοί', list.length)}</small>
      </div>
      {!list.length && (
        <div className="name-check-empty">
          <CheckCheck size={22} />
          <strong>{tr('Δεν υπάρχουν κωδικοί με διαφορετικές ονομασίες.')}</strong>
        </div>
      )}
      {list.slice(0, shown).map(g => (
        <CodeGroupCard
          key={`${g.code}|${g.names.map(n => n.name).join('|')}`}
          group={g}
          currentName={currentName}
          editable={editable}
          onApply={onApply}
          onSkip={() => setHidden(current => new Set(current).add(g.code))}
        />
      ))}
      {list.length > shown && (
        <AppButton size="sm" onClick={() => setShown(n => n + PAGE)}>
          {tr('Περισσότεροι κωδικοί ({0} ακόμη)', list.length - shown)}
        </AppButton>
      )}
    </section>
  );
}

function CodeGroupCard({
  group,
  currentName,
  editable,
  onApply,
  onSkip,
}: {
  group: CodeGroup;
  currentName: Map<string, string>;
  editable: boolean;
  onApply: Apply;
  onSkip: () => void;
}) {
  const [target, setTarget] = useState(group.suggested);
  const [custom, setCustom] = useState('');
  // A name that looks like another instrument stays out unless chosen.
  const [included, setIncluded] = useState<Set<string>>(
    () => new Set(group.names.filter(n => !n.odd).map(n => n.name)),
  );
  const finalName = cleanName(custom) || target;
  // Compared with each instrument's name as written now: a lower-case spelling of the chosen name changes too.
  const changes = group.names
    .filter(n => included.has(n.name))
    .flatMap(n => n.ids.filter(id => currentName.get(id) !== finalName).map(id => ({id, name: finalName})));
  const toggle = (name: string) =>
    setIncluded(current => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  return (
    <article className="name-check-group">
      <header>
        <div>
          <code>{group.code}</code>
          <small>{tr('{0} εργαλεία · {1} ονομασίες', group.total, group.names.length)}</small>
        </div>
        {group.names.some(n => n.odd) && (
          <span className="name-check-odd">
            <AlertTriangle size={14} /> {tr('Πιθανό λάθος κωδικός')}
          </span>
        )}
      </header>
      <ul>
        {group.names.map(n => (
          <li key={n.name} className={n.odd ? 'odd' : ''}>
            {editable && (
              <input
                type="checkbox"
                title={tr('Μπαίνει στην ενοποίηση')}
                checked={included.has(n.name)}
                onChange={() => toggle(n.name)}
              />
            )}
            <label>
              {editable && (
                <input
                  type="radio"
                  name={`target-${group.code}`}
                  checked={!custom.trim() && target === n.name}
                  onChange={() => {
                    setTarget(n.name);
                    setCustom('');
                    setIncluded(current => new Set(current).add(n.name));
                  }}
                />
              )}
              <span>{n.name}</span>
            </label>
            <CountButton ids={n.ids} title={`${group.code} · ${n.name}`} />
            {n.odd && <em>{tr('Άλλο εργαλείο;')}</em>}
          </li>
        ))}
      </ul>
      {editable && (
        <footer>
          <input value={custom} onChange={e => setCustom(e.target.value)} placeholder={tr('Ή γράψτε άλλη ονομασία…')} />
          <AppButton size="sm" onClick={onSkip}>
            {tr('Παράλειψη')}
          </AppButton>
          <AppButton
            size="sm"
            variant="primary"
            icon={<CheckCheck size={14} />}
            disabled={!changes.length}
            onClick={() => onApply(changes, tr('Κωδικός {0} → «{1}»', group.code, finalName))}
          >
            {tr('Ενοποίηση ({0} εργαλεία)', changes.length)}
          </AppButton>
        </footer>
      )}
    </article>
  );
}

const LIST_ROWS = 300;

/** The instruments behind a count: where each one is now, opening its page on a click. */
function ToolsList({
  ids,
  title,
  tools,
  sets,
  onClose,
}: {
  ids: string[];
  title: string;
  tools: ReturnType<typeof useSurgi>['tools'];
  sets: ReturnType<typeof useSurgi>['sets'];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const wanted = new Set(ids);
  const rows = tools.filter(t => wanted.has(t.id));
  const setName = new Map(sets.map(x => [x.id, `${x.barcode} · ${x.name}`]));
  const place = (t: (typeof rows)[number]) =>
    t.setId ? setName.get(t.setId) || tr('Σετ') : t.mode === 'STOCK' ? tr('Απόθεμα') : trData(t.department) || '—';
  return (
    <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <div className="name-check-list" role="dialog" aria-modal="true">
        <header>
          <div>
            <span>{tr('{0} εργαλεία', rows.length)}</span>
            <h3>{title}</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={tr('Κλείσιμο')}>
            <X size={18} />
          </button>
        </header>
        <div className="name-check-list-table">
          <table>
            <thead>
              <tr>
                <th>Barcode</th>
                <th>{tr('Ονομασία')}</th>
                <th>{tr('Κωδικός')}</th>
                <th>{tr('Θέση')}</th>
                <th>{tr('Κατάσταση')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, LIST_ROWS).map(t => (
                <tr key={t.id} onClick={() => navigate(`/tools/${t.id}`)}>
                  <td className="mono">{t.barcode}</td>
                  <td>{t.name}</td>
                  <td>{t.code || '—'}</td>
                  <td>{place(t)}</td>
                  <td>{statusLabel(t.state)}</td>
                  <td className="go">
                    <ChevronRight size={15} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > LIST_ROWS && <small>{tr('Εμφανίζονται {0} από {1}.', LIST_ROWS, rows.length)}</small>}
      </div>
    </div>
  );
}
