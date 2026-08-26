import {useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {ChevronRight, ClipboardList, Layers3, Search, ShieldCheck, Wrench} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import type {SetAsset, Tool} from '../../types/domain';

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
  const {sets, tools, issues, currentUser} = useSurgi();
  const dept = currentUser.department;
  const lastOpenedKey =
    typeof window !== 'undefined' ? sessionStorage.getItem('surgitrack.department.lastAsset') : null;
  const initialCategory: Category = lastOpenedKey?.startsWith('TOOL:') ? 'TOOLS' : 'SETS';
  const [category, setCategory] = useState<Category>(initialCategory);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [query, setQuery] = useState('');
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
          <span className="eyebrow">ΣΕΤ & ΕΡΓΑΛΕΙΑ ΤΜΗΜΑΤΟΣ</span>
          <h1>{dept}</h1>
          <p>
            Τα Σετ και τα μεμονωμένα εργαλεία του τμήματος, οι αναφορές και η ηλεκτρονική αποστολή προς Κεντρική
            Αποστείρωση.
          </p>
        </div>
        <div className="department-user-sign">
          <ShieldCheck size={18} />
          <span>Συνδεδεμένος χρήστης</span>
          <strong>{currentUser.name}</strong>
        </div>
      </header>

      <section className="department-kpis">
        <div>
          <span>Στο τμήμα</span>
          <strong>{atDepartment}</strong>
        </div>
        <div>
          <span>Προς / στην Αποστείρωση</span>
          <strong>{inSterilization}</strong>
        </div>
        <div>
          <span>Έτοιμα για παραλαβή</span>
          <strong>{ready}</strong>
        </div>
        <div>
          <span>Ανοικτές εκκρεμότητες</span>
          <strong>{openIssues}</strong>
        </div>
      </section>

      <section className="department-assets-panel">
        <div className="department-category-tabs">
          <button className={category === 'SETS' ? 'active' : ''} onClick={() => setCategory('SETS')}>
            <Layers3 size={19} />
            <span>
              <strong>Σετ εργαλείων</strong>
              <small>{departmentSets.length} Σετ του τμήματος</small>
            </span>
            <b>{departmentSets.length}</b>
          </button>
          <button className={category === 'TOOLS' ? 'active' : ''} onClick={() => setCategory('TOOLS')}>
            <Wrench size={19} />
            <span>
              <strong>Μεμονωμένα εργαλεία</strong>
              <small>{departmentTools.length} εργαλεία σε αυτόνομη χρήση</small>
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
              placeholder="Ονομασία, κωδικός ή barcode..."
            />
          </label>
          <div className="department-status-tabs">
            <button className={statusFilter === 'ALL' ? 'active' : ''} onClick={() => setStatusFilter('ALL')}>
              Όλα
            </button>
            <button
              className={statusFilter === 'IN_DEPARTMENT' ? 'active' : ''}
              onClick={() => setStatusFilter('IN_DEPARTMENT')}
            >
              Στο τμήμα
            </button>
            <button
              className={statusFilter === 'STERILIZATION' ? 'active' : ''}
              onClick={() => setStatusFilter('STERILIZATION')}
            >
              Αποστείρωση
            </button>
            <button className={statusFilter === 'READY' ? 'active' : ''} onClick={() => setStatusFilter('READY')}>
              Έτοιμα
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
                      <strong>{asset.name}</strong>
                      <small>
                        {asset.code} · {asset.specialty}
                        {kind === 'SET' ? ` · ${memberCount}/${(asset as SetAsset).expected} εργαλεία` : ''}
                      </small>
                    </div>
                    <div className="department-asset-state">
                      <small>Κατάσταση</small>
                      <span className={`badge badge-${asset.state.toLowerCase()}`}>
                        {departmentStateLabel[asset.state] || asset.state}
                      </span>
                    </div>
                    <div className="department-asset-uses">
                      <small>Χρήσεις</small>
                      <strong>
                        {asset.maxUses !== undefined
                          ? `${asset.uses || 0}/${asset.maxUses}`
                          : `${asset.uses || 0} · χωρίς όριο`}
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
              <strong>Δεν υπάρχουν εγγραφές με αυτά τα φίλτρα.</strong>
              <span>Άλλαξε κατηγορία, κατάσταση ή αναζήτηση.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
