import {useEffect, useMemo, useRef, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {ArrowLeft, ChevronRight, ClipboardList, Layers3, Search, ShieldCheck, Wrench} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import type {SetAsset, Tool} from '../../types/domain';
import {tr, trData} from '../../i18n';
import {presetPath, useRememberedState} from '../../core/listMemory';
import ColorMarker from '../../components/assets/ColorMarker';
import {effectiveToolMarker} from '../../core/colorTapes';

type Category = 'SETS' | 'TOOLS';
type StatusFilter = 'ALL' | 'IN_DEPARTMENT' | 'STERILIZATION' | 'READY';
type DepartmentItem = {kind: 'SET' | 'TOOL'; asset: SetAsset | Tool};
const departmentStateLabel: Record<string, string> = {
  IN_DEPARTMENT: 'Στο τμήμα',
  PENDING_STERILIZATION: 'Αναμονή παραλαβής',
  IN_WASHING: 'Καθαρισμός & Απολύμανση',
  IN_PREPARATION: 'Σε προετοιμασία',
  IN_PACKAGING: 'Συσκευασία & Σήμανση',
  IN_STERILIZATION: 'Σε αποστείρωση',
  AWAITING_RELEASE: 'Αναμονή αποδέσμευσης',
  IN_STORAGE: 'Αποθήκευση',
  READY_FOR_PICKUP: 'Έτοιμο για παραλαβή',
  SERVICE: 'Service',
  LOST: 'Απολεσθέν',
};

export default function DepartmentPage() {
  const {sets, tools, issues, currentUser, role} = useSurgi();
  // From the Overview, the admin and Sterilization look at one department as the department sees it.
  const [params] = useSearchParams();
  const viewing = role === 'DEPARTMENT' ? '' : params.get('d') || '';
  const dept = viewing || currentUser.department;
  const lastOpenedKey =
    typeof window !== 'undefined' ? sessionStorage.getItem('surgitrack.department.lastAsset') : null;
  const initialCategory: Category = lastOpenedKey?.startsWith('TOOL:') ? 'TOOLS' : 'SETS';
  const [category, setCategory] = useState<Category>(initialCategory);
  const [statusFilter, setStatusFilter] = useRememberedState<StatusFilter>('statusFilter', 'ALL');
  const [query, setQuery] = useRememberedState('query', '');
  const [lastOpened, setLastOpened] = useState(lastOpenedKey);
  const highlightedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (highlightedRef.current) {
      highlightedRef.current.scrollIntoView({block: 'nearest'});
    }
  }, [category, statusFilter]);

  const departmentSets = useMemo(() => sets.filter(item => item.department === dept), [sets, dept]);
  const departmentTools = useMemo(
    () => tools.filter(item => item.department === dept && item.mode === 'STANDALONE'),
    [tools, dept],
  );
  const allDepartmentItems = useMemo<DepartmentItem[]>(
    () => [
      ...departmentSets.map(asset => ({kind: 'SET' as const, asset})),
      ...departmentTools.map(asset => ({kind: 'TOOL' as const, asset})),
    ],
    [departmentSets, departmentTools],
  );
  const ready = allDepartmentItems.filter(item => item.asset.state === 'READY_FOR_PICKUP').length;
  const inSterilization = allDepartmentItems.filter(item =>
    [
      'PENDING_STERILIZATION',
      'IN_WASHING',
      'IN_PREPARATION',
      'IN_PACKAGING',
      'IN_STERILIZATION',
      'AWAITING_RELEASE',
      'IN_STORAGE',
    ].includes(item.asset.state),
  ).length;
  const atDepartment = allDepartmentItems.filter(item => item.asset.state === 'IN_DEPARTMENT').length;
  const openIssues = issues.filter(issue => issue.department === dept && issue.status === 'OPEN').length;
  const sourceItems: DepartmentItem[] =
    category === 'SETS'
      ? departmentSets.map(asset => ({kind: 'SET', asset}))
      : departmentTools.map(asset => ({kind: 'TOOL', asset}));
  const visibleItems = sourceItems.filter(item => {
    const stateOk =
      statusFilter === 'ALL' ||
      (statusFilter === 'IN_DEPARTMENT' && item.asset.state === 'IN_DEPARTMENT') ||
      (statusFilter === 'STERILIZATION' &&
        [
          'PENDING_STERILIZATION',
          'IN_WASHING',
          'IN_PREPARATION',
          'IN_PACKAGING',
          'IN_STERILIZATION',
          'AWAITING_RELEASE',
          'IN_STORAGE',
        ].includes(item.asset.state)) ||
      (statusFilter === 'READY' && item.asset.state === 'READY_FOR_PICKUP');
    const haystack =
      `${item.asset.name} ${item.asset.code} ${item.asset.barcode} ${item.asset.specialty} ${(item.asset as Tool).manufacturer || ''}`.toLowerCase();
    return stateOk && haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="department-workspace">
      <header className="department-header">
        <div>
          <span className="eyebrow">{tr('ΣΕΤ & ΕΡΓΑΛΕΙΑ ΤΜΗΜΑΤΟΣ')}</span>
          <h1>{trData(dept)}</h1>
          <p>
            {tr(
              'Τα Σετ και τα μεμονωμένα εργαλεία του τμήματος, οι αναφορές και η ηλεκτρονική αποστολή προς Κεντρική Αποστείρωση.',
            )}
          </p>
        </div>
        {viewing ? (
          <Link className="department-user-sign department-back" to="/overview">
            <ArrowLeft size={18} />
            <span>{tr('Προβολή τμήματος')}</span>
            <strong>{tr('Πίσω στην Επισκόπηση')}</strong>
          </Link>
        ) : (
          <div className="department-user-sign">
            <ShieldCheck size={18} />
            <span>{tr('Συνδεδεμένος χρήστης')}</span>
            <strong>{trData(currentUser.name)}</strong>
          </div>
        )}
      </header>

      <section className="department-kpis">
        {(
          [
            {filter: 'IN_DEPARTMENT', label: tr('Στο τμήμα'), value: atDepartment},
            {filter: 'STERILIZATION', label: tr('Προς / στην Αποστείρωση'), value: inSterilization},
            {filter: 'READY', label: tr('Έτοιμα για παραλαβή'), value: ready},
          ] as const
        ).map(k => (
          <button
            key={k.filter}
            type="button"
            className={statusFilter === k.filter ? 'active' : ''}
            aria-pressed={statusFilter === k.filter}
            onClick={() => setStatusFilter(statusFilter === k.filter ? 'ALL' : k.filter)}
          >
            <span>{k.label}</span>
            <strong>{k.value}</strong>
          </button>
        ))}
        <Link to={presetPath('/issues', {status: 'OPEN', department: dept})}>
          <span>{tr('Ανοικτές εκκρεμότητες')}</span>
          <strong>{openIssues}</strong>
        </Link>
      </section>

      <section className="department-assets-panel">
        <div className="department-category-tabs">
          <button className={category === 'SETS' ? 'active' : ''} onClick={() => setCategory('SETS')}>
            <Layers3 size={19} />
            <span>
              <strong>{tr('Σετ εργαλείων')}</strong>
              <small>
                {departmentSets.length} {tr('Σετ του τμήματος')}
              </small>
            </span>
            <b>{departmentSets.length}</b>
          </button>
          <button className={category === 'TOOLS' ? 'active' : ''} onClick={() => setCategory('TOOLS')}>
            <Wrench size={19} />
            <span>
              <strong>{tr('Μεμονωμένα εργαλεία')}</strong>
              <small>
                {departmentTools.length} {tr('εργαλεία σε αυτόνομη χρήση')}
              </small>
            </span>
            <b>{departmentTools.length}</b>
          </button>
        </div>
        <div className="department-list-toolbar">
          <label className="department-search">
            <Search size={17} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={tr('Ονομασία, κωδικός ή barcode...')}
            />
          </label>
          <div className="department-status-tabs">
            <button className={statusFilter === 'ALL' ? 'active' : ''} onClick={() => setStatusFilter('ALL')}>
              {tr('Όλα')}
            </button>
            <button
              className={statusFilter === 'IN_DEPARTMENT' ? 'active' : ''}
              onClick={() => setStatusFilter('IN_DEPARTMENT')}
            >
              {tr('Στο τμήμα')}
            </button>
            <button
              className={statusFilter === 'STERILIZATION' ? 'active' : ''}
              onClick={() => setStatusFilter('STERILIZATION')}
            >
              {tr('Αποστείρωση')}
            </button>
            <button className={statusFilter === 'READY' ? 'active' : ''} onClick={() => setStatusFilter('READY')}>
              {tr('Έτοιμα')}
            </button>
          </div>
        </div>
        <div className="department-asset-list">
          {visibleItems.length ? (
            visibleItems.map(({kind, asset}) => {
              const memberCount = kind === 'SET' ? tools.filter(tool => tool.setId === asset.id).length : undefined;
              const href = kind === 'SET' ? `/sets/${asset.id}` : `/tools/${asset.id}`;
              const rowKey = `${kind}:${asset.id}`;
              const isLastOpened = lastOpened === rowKey;
              return (
                <article
                  ref={node => {
                    if (isLastOpened) highlightedRef.current = node;
                  }}
                  className={`department-asset-row ${isLastOpened ? 'last-opened' : ''}`}
                  key={`${kind}-${asset.id}`}
                >
                  <Link
                    className="department-asset-open"
                    to={href}
                    onClick={() => {
                      sessionStorage.setItem('surgitrack.department.lastAsset', rowKey);
                      setLastOpened(rowKey);
                    }}
                  >
                    <AssetTypeIcon
                      kind={kind}
                      maxUses={kind === 'TOOL' ? asset.maxUses : undefined}
                      framed
                      className="department-asset-icon"
                      size={19}
                    />
                    <div className="department-asset-identity">
                      <span className="mono">{asset.barcode}</span>
                      <strong>
                        {asset.name}{' '}
                        <ColorMarker
                          size="sm"
                          tapes={
                            kind === 'SET'
                              ? (asset as SetAsset).colorTapes
                              : effectiveToolMarker(
                                  asset as Tool,
                                  sets.find(s => s.id === (asset as Tool).setId),
                                )
                          }
                        />
                      </strong>
                      <small>
                        {asset.code} · {trData(asset.specialty)}
                        {kind === 'SET' ? tr(' · {0}/{1} εργαλεία', memberCount, (asset as SetAsset).expected) : ''}
                      </small>
                    </div>
                    <div className="department-asset-state">
                      <small>{tr('Κατάσταση')}</small>
                      <span className={`badge badge-${asset.state.toLowerCase()}`}>
                        {tr(departmentStateLabel[asset.state] || asset.state)}
                      </span>
                    </div>
                    <div className="department-asset-uses">
                      <small>{tr('Χρήσεις')}</small>
                      <strong>
                        {asset.maxUses !== undefined
                          ? `${asset.uses || 0}/${asset.maxUses}`
                          : tr('{0} · χωρίς όριο', asset.uses || 0)}
                      </strong>
                    </div>
                    <ChevronRight size={19} />
                  </Link>
                </article>
              );
            })
          ) : (
            <div className="department-empty">
              <ClipboardList size={28} />
              <strong>{tr('Δεν υπάρχουν εγγραφές με αυτά τα φίλτρα.')}</strong>
              <span>{tr('Άλλαξε κατηγορία, κατάσταση ή αναζήτηση.')}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
