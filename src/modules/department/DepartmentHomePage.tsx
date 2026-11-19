import {useMemo} from 'react';
import {Link} from 'react-router-dom';
import {CalendarClock, ChevronRight, PackageCheck, TriangleAlert} from 'lucide-react';
import {expiryAlerts, expiryStatus, formatExpiry, sterileExpiryList} from '../../core/sterileExpiry';
import {presetPath} from '../../core/listMemory';
import PageHeader from '../../components/ui/PageHeader';
import {useSurgi} from '../../store/SurgiStore';
import {tr, trData} from '../../i18n';

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
 * The department's home: what it has to do now (pick up what is ready, renew what expires, see to its issues), then
 * its equipment one line per kind — how many are here to use, how many are away in Sterilization (and ready to pick
 * up), and the first expiry — so «do we have enough of what we need?» reads at a glance.
 */
export default function DepartmentHomePage() {
  const {sets, tools, issues, currentUser} = useSurgi();
  const dept = currentUser.department;

  const departmentSets = useMemo(() => sets.filter(item => item.department === dept), [sets, dept]);
  const departmentTools = useMemo(() => tools.filter(item => item.department === dept), [tools, dept]);
  const standalone = useMemo(() => departmentTools.filter(t => t.mode === 'STANDALONE'), [departmentTools]);
  const openIssues = issues.filter(issue => issue.department === dept && issue.status === 'OPEN');
  const expiry = expiryAlerts(sterileExpiryList(departmentSets, departmentTools));
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

  const todo = [
    {
      key: 'ready',
      icon: PackageCheck,
      n: ready,
      label: tr('Παραλαβή'),
      note: tr('έτοιμα στην Αποστείρωση'),
      to: readyPath,
    },
    {
      key: 'expiry',
      icon: CalendarClock,
      n: expiry.length,
      label: tr('Λήξεις'),
      note: expired ? tr('{0} έληξαν', expired) : tr('λήγουν σύντομα'),
      to: '/expiry',
    },
    {
      key: 'issues',
      icon: TriangleAlert,
      n: openIssues.length,
      label: tr('Εκκρεμότητες'),
      note: tr('ανοιχτές'),
      to: issuesPath,
    },
  ];
  const sections: Array<{kind: 'SET' | 'TOOL'; title: string; to: string}> = [
    {kind: 'SET', title: tr('Σετ'), to: '/department'},
    {kind: 'TOOL', title: tr('Μεμονωμένα εργαλεία'), to: '/department/tools'},
  ];

  return (
    <div className="department-home">
      <PageHeader eyebrow={tr('Αρχική τμήματος')} title={trData(dept)} />

      <nav className="dept-todo" aria-label={tr('Τι έχω να κάνω')}>
        {todo.map(t => (
          <Link key={t.key} to={t.to} className={`dept-todo-item${t.n ? ` on ${t.key}` : ''}`}>
            <t.icon size={20} aria-hidden="true" />
            <b>{t.n}</b>
            <span>
              <strong>{t.label}</strong>
              <small>{t.note}</small>
            </span>
          </Link>
        ))}
      </nav>

      <section className="dept-stock" aria-labelledby="dept-stock-title">
        <h2 id="dept-stock-title">{tr('Ο εξοπλισμός μου')}</h2>
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
    </div>
  );
}
