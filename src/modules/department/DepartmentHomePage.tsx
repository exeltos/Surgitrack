import {useMemo} from 'react';
import {Link} from 'react-router-dom';
import {ChevronRight, Gauge, Layers3, Wrench} from 'lucide-react';
import {expiryAlerts, expiryStatus, formatExpiry, sterileExpiryList} from '../../core/sterileExpiry';
import {presetPath} from '../../core/listMemory';
import PageHeader from '../../components/ui/PageHeader';
import {useSurgi} from '../../store/SurgiStore';
import {tr, trData} from '../../i18n';
import {isDispatch} from './departmentStatus';
import TodayBand from '../../components/layout/TodayBand';

/** Every state the department counts as «Στην Αποστείρωση». */
const IN_STERILIZATION_STATES: string[] = [
  'PENDING_STERILIZATION',
  'IN_WASHING',
  'IN_PREPARATION',
  'IN_PACKAGING',
  'IN_STERILIZATION',
  'AWAITING_RELEASE',
  'IN_STORAGE',
];

/** «Κοντά στο όριο»: a limited-use Set or instrument with this many uses left, or fewer. */
const NEAR_END = 3;

type Kind = {
  key: string;
  kind: 'SET' | 'TOOL';
  name: string;
  here: number;
  away: number;
  ready: number;
  total: number;
  /** The soonest expiry of the ones in the department (yyyy-mm-dd), and whether it is past or near. */
  expiry?: string;
  expiryState?: 'OK' | 'EXPIRING' | 'EXPIRED';
};

/**
 * The department's home, in the Overview's look: «Σήμερα» (what to pick up, what expires, the open issues, the first
 * thing to do, this week); then the uses of its equipment — the limited-use ones near their end (3 left or fewer) and
 * the uses of those only counted — or, with neither, its equipment one line per kind; beside its most frequent uses.
 */
export default function DepartmentHomePage() {
  const {sets, tools, issues, movements, currentUser} = useSurgi();
  const dept = currentUser.department;

  const departmentSets = useMemo(() => sets.filter(item => item.department === dept), [sets, dept]);
  const departmentTools = useMemo(() => tools.filter(item => item.department === dept), [tools, dept]);
  const standalone = useMemo(() => departmentTools.filter(t => t.mode === 'STANDALONE'), [departmentTools]);
  const openIssues = issues.filter(issue => issue.department === dept && issue.status === 'OPEN');
  const sterile = sterileExpiryList(departmentSets, departmentTools);
  const expiry = expiryAlerts(sterile);
  const expired = expiry.filter(e => e.state === 'EXPIRED').length;

  // One line per kind (a Set's name, an instrument's name), Sets first.
  const kinds = useMemo(() => {
    const rows = new Map<string, Kind>();
    const add = (
      kind: 'SET' | 'TOOL',
      a: {name: string; state: string; sterileUntil?: string; shelfLifeMonths?: number},
    ) => {
      const key = `${kind}|${a.name.trim().toUpperCase()}`;
      const row = rows.get(key) || {key, kind, name: a.name.trim(), here: 0, away: 0, ready: 0, total: 0};
      row.total++;
      if (a.state === 'IN_DEPARTMENT') {
        row.here++;
        if (a.sterileUntil && (!row.expiry || a.sterileUntil < row.expiry)) {
          row.expiry = a.sterileUntil;
          row.expiryState = expiryStatus(a.sterileUntil, a.shelfLifeMonths).state;
        }
      } else if (a.state === 'READY_FOR_PICKUP') {
        row.away++;
        row.ready++;
      } else if (IN_STERILIZATION_STATES.includes(a.state)) row.away++;
      rows.set(key, row);
    };
    departmentSets.forEach(s => add('SET', s));
    standalone.forEach(t => add('TOOL', t));
    return [...rows.values()].sort(
      (a, b) => Number(b.kind === 'SET') - Number(a.kind === 'SET') || a.name.localeCompare(b.name, 'el'),
    );
  }, [departmentSets, standalone]);
  const ready = kinds.reduce((n, k) => n + k.ready, 0);
  const readyPath = presetPath(kinds.some(k => k.kind === 'SET' && k.ready) ? '/department' : '/department/tools', {
    statusFilter: 'READY',
  });
  const issuesPath = presetPath('/issues', {status: 'OPEN', department: dept});

  // «Σήμερα», as on the Overview: what the department has to do — pick up, renew what expires, its issues — the first of
  // them, and this week's movements.
  const counts = [
    {n: ready, label: tr('Για παραλαβή'), to: readyPath},
    {n: expiry.length, label: tr('Λήγουν σύντομα'), to: '/expiry'},
    {n: openIssues.length, label: tr('Εκκρεμότητες'), to: issuesPath},
  ];
  const next = ready
    ? {title: tr('{0} έτοιμα για παραλαβή από την Αποστείρωση', ready), to: readyPath}
    : expiry.length
      ? {
          title: expired
            ? tr('{0} έληξαν · {1} λήγουν σύντομα', expired, expiry.length - expired)
            : tr('{0} λήγουν σύντομα', expiry.length),
          to: '/expiry',
        }
      : openIssues.length
        ? {title: tr('{0} ανοιχτές εκκρεμότητες', openIssues.length), to: issuesPath}
        : undefined;
  const weekEvents = useMemo(
    () => movements.filter(m => isDispatch(m, dept) || m.to === dept).map(m => m.at),
    [movements, dept],
  );

  // Limited-use Sets and instruments (a number of lives) with 3 uses left or fewer, the fewest first; and those whose
  // uses are only counted (a wear check), each with its uses, the most first.
  const limited = [
    ...departmentSets.map(x => ({...x, kind: 'SET' as const})),
    ...departmentTools.map(t => ({...t, kind: 'TOOL' as const})),
  ]
    .filter(a => (a.maxUses ?? 0) > 0)
    .map(a => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      barcode: a.barcode,
      uses: a.uses || 0,
      max: a.maxUses!,
      left: Math.max(0, a.maxUses! - (a.uses || 0)),
    }))
    .sort((a, b) => a.left - b.left || a.name.localeCompare(b.name, 'el'));
  const nearEnd = limited.filter(a => a.left <= NEAR_END);
  const counted = [
    ...departmentSets.map(x => ({...x, kind: 'SET' as const})),
    ...departmentTools.map(t => ({...t, kind: 'TOOL' as const})),
  ]
    .filter(a => !a.maxUses && 'wearCheck' in a && a.wearCheck)
    .map(a => ({id: a.id, kind: a.kind, name: a.name, barcode: a.barcode, uses: a.uses || 0}))
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name, 'el'));
  const countedMax = Math.max(1, ...counted.map(a => a.uses));
  const showsUses = limited.length > 0 || counted.length > 0;

  // The most frequent uses: the Sets and instruments used most, the busiest first.
  const mostUsed = [
    ...departmentSets.map(x => ({id: x.id, kind: 'SET' as const, barcode: x.barcode, name: x.name, uses: x.uses || 0})),
    ...departmentTools.map(t => ({
      id: t.id,
      kind: 'TOOL' as const,
      barcode: t.barcode,
      name: t.name,
      uses: t.uses || 0,
    })),
  ]
    .filter(a => a.uses > 0)
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 15);
  const mostUsedMax = Math.max(1, ...mostUsed.map(a => a.uses));
  const sections: Array<{kind: 'SET' | 'TOOL'; title: string; to: string}> = [
    {kind: 'SET', title: tr('Σετ'), to: '/department'},
    {kind: 'TOOL', title: tr('Μεμονωμένα εργαλεία'), to: '/department/tools'},
  ];

  return (
    <div className="department-home dash">
      <PageHeader eyebrow={tr('Αρχική τμήματος')} title={trData(dept)} />

      <TodayBand
        counts={counts}
        next={next}
        events={weekEvents}
        eventsLabel={n => tr('{0} κινήσεις', n)}
        expiries={sterile}
      />

      <div className="dash-grid">
        {showsUses ? (
          <section className="dash-card dept-lives" aria-labelledby="dept-lives-title">
            <header>
              <div>
                <b id="dept-lives-title">{tr('Χρήσεις εξοπλισμού')}</b>
                <small>{tr('Όσα κοντεύουν στο όριο χρήσεων, και οι χρήσεις όσων απλώς μετρούν.')}</small>
              </div>
              <Gauge size={18} />
            </header>
            <div className="dept-lives-body" tabIndex={0} role="region" aria-labelledby="dept-lives-title">
              {limited.length > 0 && (
                <>
                  <h3>
                    {tr('Κοντά στο όριο')} <span>{tr('{0} χρήσεις ή λιγότερες', NEAR_END)}</span>
                  </h3>
                  {nearEnd.length ? (
                    <ul className="dash-list dash-lives" aria-label={tr('Κοντά στο όριο')}>
                      {nearEnd.map(a => (
                        <li key={a.id} className={a.left === 0 ? 'out' : 'near'}>
                          {a.kind === 'SET' ? (
                            <Layers3 size={15} aria-hidden="true" />
                          ) : (
                            <Wrench size={15} aria-hidden="true" />
                          )}
                          <Link to={a.kind === 'SET' ? `/sets/${a.id}` : `/tools/${a.id}`}>
                            <b>{a.name}</b>
                            <small>{a.barcode}</small>
                          </Link>
                          <span className="dash-lives-track" aria-hidden="true">
                            <i style={{width: `${Math.min(100, (a.uses / a.max) * 100)}%`}} />
                          </span>
                          <span className="dash-lives-count">
                            <strong>
                              {a.uses} / {a.max}
                            </strong>
                            <small>{a.left === 0 ? tr('Εξαντλήθηκε') : tr('απομένουν {0}', a.left)}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="dept-lives-none">
                      {tr('Κανένα · {0} με όριο χρήσεων, όλα με περισσότερες από {1}.', limited.length, NEAR_END)}
                    </p>
                  )}
                </>
              )}
              {counted.length > 0 && (
                <>
                  <h3>{tr('Καταμέτρηση χρήσεων')}</h3>
                  <ul className="dash-list dash-lives" aria-label={tr('Καταμέτρηση χρήσεων')}>
                    {counted.map(a => (
                      <li key={a.id}>
                        {a.kind === 'SET' ? (
                          <Layers3 size={15} aria-hidden="true" />
                        ) : (
                          <Wrench size={15} aria-hidden="true" />
                        )}
                        <Link to={a.kind === 'SET' ? `/sets/${a.id}` : `/tools/${a.id}`}>
                          <b>{a.name}</b>
                          <small>{a.barcode}</small>
                        </Link>
                        <span className="dash-lives-track" aria-hidden="true">
                          <i style={{width: `${(a.uses / countedMax) * 100}%`}} />
                        </span>
                        <span className="dash-lives-count">
                          <strong>{a.uses}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>
        ) : (
          <section className="dash-card dept-stock" aria-labelledby="dept-stock-title">
            <header>
              <div>
                <b id="dept-stock-title">{tr('Ο εξοπλισμός μου')}</b>
                <small>{tr('Ανά είδος: πόσα είναι στο τμήμα, πόσα στην Αποστείρωση, η πρώτη λήξη.')}</small>
              </div>
              <Layers3 size={18} />
            </header>
            <div className="dept-stock-wrap" role="region" tabIndex={0} aria-labelledby="dept-stock-title">
              <table className="dept-stock-table">
                <thead>
                  <tr>
                    <th scope="col">{tr('Είδος')}</th>
                    <th scope="col">{tr('Στο τμήμα')}</th>
                    <th scope="col">{tr('Στην Αποστείρωση')}</th>
                    <th scope="col">{tr('Σύνολο')}</th>
                    <th scope="col">{tr('Πρώτη λήξη')}</th>
                    <th scope="col">
                      <span className="visually-hidden">{tr('Άνοιγμα')}</span>
                    </th>
                  </tr>
                </thead>
                {sections.map(section => {
                  const rows = kinds.filter(k => k.kind === section.kind);
                  if (!rows.length) return null;
                  return (
                    <tbody key={section.kind}>
                      <tr className="dept-stock-group">
                        <th colSpan={6} scope="rowgroup">
                          {section.title} <span>{rows.reduce((n, k) => n + k.total, 0)}</span>
                        </th>
                      </tr>
                      {rows.map(k => (
                        <tr key={k.key} className={k.here === 0 ? 'none-here' : undefined}>
                          <th scope="row">
                            <Link to={presetPath(section.to, {query: k.name})}>{k.name}</Link>
                          </th>
                          <td className="dept-n">{k.here}</td>
                          <td>
                            {k.away ? (
                              <>
                                {k.away}
                                {k.ready > 0 && <em className="dept-ready"> · {tr('{0} για παραλαβή', k.ready)}</em>}
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>{k.total}</td>
                          <td
                            className={
                              k.expiryState && k.expiryState !== 'OK'
                                ? `dept-exp ${k.expiryState.toLowerCase()}`
                                : undefined
                            }
                          >
                            {k.expiry ? (k.expiryState === 'EXPIRED' ? tr('Έληξε') : formatExpiry(k.expiry)) : '—'}
                          </td>
                          <td className="dept-open">
                            <Link to={presetPath(section.to, {query: k.name})} aria-label={tr('Άνοιγμα: {0}', k.name)}>
                              <ChevronRight size={16} aria-hidden="true" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  );
                })}
              </table>
              {kinds.length === 0 && <p className="dept-empty">{tr('Το τμήμα δεν έχει ακόμα εξοπλισμό.')}</p>}
            </div>
          </section>
        )}

        <section className="dash-card dash-most-used">
          <header>
            <div>
              <b>{tr('Συχνότερες χρήσεις')}</b>
              <small>{tr('Τα Σετ και τα εργαλεία του τμήματος με τις περισσότερες χρήσεις.')}</small>
            </div>
            <Gauge size={18} />
          </header>
          {mostUsed.length ? (
            <>
              <ol className="dept-cols" aria-label={tr('Συχνότερες χρήσεις')}>
                {mostUsed.slice(0, 8).map((a, i) => (
                  <li key={a.id} className={a.kind === 'SET' ? 'set' : 'tool'}>
                    <Link
                      to={a.kind === 'SET' ? `/sets/${a.id}` : `/tools/${a.id}`}
                      title={`${a.name} · ${a.barcode}: ${a.uses}`}
                      aria-label={`${a.name} ${a.barcode}: ${a.uses}`}
                    >
                      <b aria-hidden="true">{a.uses}</b>
                      <span className="dept-col" aria-hidden="true">
                        <i style={{height: `${Math.max(4, (a.uses / mostUsedMax) * 100)}%`}} />
                      </span>
                      <small aria-hidden="true">{i + 1}</small>
                    </Link>
                  </li>
                ))}
              </ol>
              <ol className="dept-cols-names" aria-hidden="true">
                {mostUsed.slice(0, 8).map(a => (
                  <li key={a.id}>
                    <span>{a.name}</span>
                    <small>{a.barcode}</small>
                  </li>
                ))}
              </ol>
              <p className="dept-cols-legend">
                <span className="set">{tr('Σετ')}</span>
                <span className="tool">{tr('Εργαλεία')}</span>
              </p>
            </>
          ) : (
            <p className="dept-empty">{tr('Καμία χρήση ακόμα.')}</p>
          )}
        </section>
      </div>
    </div>
  );
}
