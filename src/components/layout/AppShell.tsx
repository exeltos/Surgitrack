import {Suspense, useEffect, useRef, useState, type ReactNode} from 'react';
import {NavLink, useLocation, useNavigate} from 'react-router-dom';
import {
  Accessibility,
  Bell,
  BookOpen,
  Home,
  LogOut,
  Menu,
  Minus,
  Plus,
  Search,
  X,
  PackageCheck,
  TriangleAlert,
  Gauge,
  UserPlus,
} from 'lucide-react';
import {navigationFor} from '../../config/navigation';
import {useSurgi, type UserRole} from '../../store/SurgiStore';
import {useAppPreferences} from '../../core/AppPreferences';
import {getRuntimeDataMode, setRuntimeDataMode} from '../../config/dataMode';
import RoleSwitcher from './RoleSwitcher';
import {actingAsPlatformOwner, getRealIdentity} from '../../data/cloud/identity';
import {ACCESS_REQUESTS_CHANGED, countPendingAccessRequests, managedHospitalId} from '../../data/cloud/accessRequests';
import {useSyncStatus} from '../../data/cloud/useAppRecordSync';
import {APP_VERSION, APP_EDITION} from '../../config/appMeta';
import {trData} from '../../i18n';
import {useListMemory} from '../../core/listMemory';
import {lazyPage} from '../../core/resilience';

// The user manual is loaded only when first opened.
const HelpCenter = lazyPage(() => import('../../core/help/HelpCenter'));
const roleLabel: Record<UserRole, {el: string; en: string}> = {
  DEPARTMENT: {el: 'Χρήστης Τμήματος', en: 'Department user'},
  STERILIZATION: {el: 'Χρήστης Αποστείρωσης', en: 'Sterilization user'},
  ADMIN: {el: 'Διαχειριστής νοσοκομείου', en: 'Hospital administrator'},
  VIEWER: {el: 'Παρατηρητής (μόνο προβολή)', en: 'Viewer (read only)'},
};
const navEN: Record<string, string> = {
  'Εξοπλισμός τμήματος': 'Department Equipment',
  Αποστείρωση: 'Sterilization',
  Εργαλεία: 'Instruments',
  'Σετ εργαλείων': 'Instrument Sets',
  'Μεμονωμένα σε χρήση': 'Standalone in Use',
  'Stock εργαλείων': 'Instrument Stock',
  Εκκρεμότητες: 'Issues',
  Αναφορές: 'Reports',
  Ιστορικό: 'History',
  'SurgiTrack Studio': 'Management Center',
  'Σετ & Εργαλεία': 'Sets & Instruments',
  'Διαχείριση νοσοκομείου': 'Hospital Administration',
  Νοσοκομεία: 'Hospitals',
  Επισκόπηση: 'Overview',
};
/** Pages the platform admin can use without having entered a hospital. */
const PLATFORM_ONLY_PAGES = ['/studio', '/hospitals'];
export default function AppShell({children, onLogout}: {children: ReactNode; onLogout?: () => void}) {
  const {
    issues,
    lifecycleAlerts,
    sets,
    tools,
    retiredTools,
    acknowledgeOutOfUse,
    currentUser,
    toast,
    clearToast,
    role,
    can,
  } = useSurgi();
  const syncStatus = useSyncStatus();
  const {lang, setLang, fontScale, setFontScale, highContrast, setHighContrast, reducedMotion, setReducedMotion} =
    useAppPreferences();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [a11y, setA11y] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [departmentReadyToast, setDepartmentReadyToast] = useState<{id: string; text: string}>();
  const [scan, setScan] = useState('');
  const [scanMatches, setScanMatches] = useState<
    Array<{id: string; kind: 'SET' | 'TOOL'; barcode: string; code: string; name: string}>
  >([]);
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef<HTMLElement>(null);
  useListMemory(contentRef);
  const isDemo = getRuntimeDataMode() === 'DEMO';
  // The platform admin belongs to no hospital, so outside Demo only Studio has anything to show.
  const platformOnly =
    !isDemo && !!getRealIdentity()?.platform && !sessionStorage.getItem('surgitrack-active-organization');
  // Hospital administration exists only for a real hospital's admin working as Admin.
  const hospitalId = role === 'ADMIN' ? managedHospitalId() : undefined;
  const [pendingAccess, setPendingAccess] = useState(0);
  useEffect(() => {
    if (!hospitalId) return;
    const refresh = () => void countPendingAccessRequests(hospitalId).then(setPendingAccess);
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener(ACCESS_REQUESTS_CHANGED, refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(ACCESS_REQUESTS_CHANGED, refresh);
    };
  }, [hospitalId, location.pathname]);
  const navigation = (
    platformOnly
      ? navigationFor(role, can).filter(item => PLATFORM_ONLY_PAGES.includes(item.to))
      : navigationFor(role, can)
  )
    .filter(item => item.to !== '/hospital' || !!hospitalId)
    // The list of all hospitals is the platform admin's, outside Demo.
    .filter(item => item.to !== '/hospitals' || actingAsPlatformOwner());
  useEffect(() => {
    if (platformOnly && !PLATFORM_ONLY_PAGES.some(page => location.pathname.startsWith(page)))
      navigate('/studio', {replace: true});
  }, [platformOnly, location.pathname, navigate]);
  const returnFromDemo = () => {
    sessionStorage.removeItem('surgitrack-demo-role');
    sessionStorage.removeItem('surgitrack-session-user');
    sessionStorage.removeItem('surgitrack-active-organization');
    setRuntimeDataMode('PRODUCTION');
    window.location.hash = '#/studio';
    window.location.reload();
  };
  const departmentAssets = [
    ...sets.filter(s => s.department === currentUser.department),
    ...tools.filter(t => t.department === currentUser.department && t.mode === 'STANDALONE'),
  ];
  const departmentReady = departmentAssets.filter(a => a.state === 'READY_FOR_PICKUP');
  const departmentIssues = issues.filter(i => i.status === 'OPEN' && i.department === currentUser.department);
  const departmentUsage = lifecycleAlerts.filter(a => departmentAssets.some(asset => asset.id === a.assetId));
  const accessRequests = hospitalId ? pendingAccess : 0;
  // Instruments that just ran out of lives: Sterilization must set them aside and confirm.
  const outOfUseNotices = role === 'DEPARTMENT' ? [] : retiredTools.filter(t => !t.retiredNoticeSeenAt);
  const openNotifications =
    role === 'DEPARTMENT'
      ? departmentReady.length + departmentIssues.length + departmentUsage.length
      : issues.filter(i => i.status === 'OPEN').length +
        lifecycleAlerts.length +
        accessRequests +
        outOfUseNotices.length;
  useEffect(() => {
    if (role !== 'DEPARTMENT' || departmentReady.length === 0) {
      setDepartmentReadyToast(undefined);
      return;
    }
    const storageKey = `surgitrack-ready-seen:${currentUser.department}`;
    let seen = new Set<string>();
    try {
      seen = new Set(JSON.parse(window.sessionStorage.getItem(storageKey) || '[]') as string[]);
    } catch {
      seen = new Set<string>();
    }
    const newlyReady = departmentReady.filter(asset => !seen.has(asset.id));
    if (!newlyReady.length) return;

    const first = newlyReady[0];
    const extra = newlyReady.length - 1;
    const text =
      lang === 'el'
        ? `${first.barcode} · ${first.name} είναι έτοιμο για παραλαβή${extra > 0 ? ` (+${extra} ακόμη)` : ''}.`
        : `${first.barcode} · ${first.name} is ready for pickup${extra > 0 ? ` (+${extra} more)` : ''}.`;
    setDepartmentReadyToast({id: first.id, text});

    newlyReady.forEach(asset => seen.add(asset.id));
    window.sessionStorage.setItem(storageKey, JSON.stringify([...seen]));
    const timer = window.setTimeout(() => setDepartmentReadyToast(undefined), 5200);
    return () => window.clearTimeout(timer);
  }, [role, currentUser.department, departmentReady.map(asset => asset.id).join('|'), lang]);
  const assetDetailMode = /^\/(tools|sets)\/[^/]+$/.test(location.pathname);
  const departmentMode = location.pathname === '/department';
  const runGlobalSearch = () => {
    const q = scan.trim().toLowerCase();
    if (!q) {
      setScanMatches([]);
      return;
    }
    const assets = [
      ...sets.map(a => ({...a, kind: 'SET' as const})),
      ...tools.map(a => ({...a, kind: 'TOOL' as const})),
    ];
    const exact = assets.find(
      a =>
        a.barcode.toLowerCase() === q ||
        a.code.toLowerCase() === q ||
        (a.legacyBarcodes || []).some(b => b.toLowerCase() === q),
    );
    if (exact) {
      setScanMatches([]);
      // An old (replaced) label still finds the item; its page says the barcode was replaced.
      const replaced = exact.barcode.toLowerCase() !== q && exact.code.toLowerCase() !== q;
      const path = exact.kind === 'SET' ? `/sets/${exact.id}` : `/tools/${exact.id}`;
      navigate(replaced ? `${path}?replaced=${encodeURIComponent(scan.trim().toUpperCase())}` : path);
      return;
    }
    const matches = assets
      .filter(a => `${a.barcode} ${a.code} ${a.name} ${(a.legacyBarcodes || []).join(' ')}`.toLowerCase().includes(q))
      .slice(0, 8)
      .map(a => ({id: a.id, kind: a.kind, barcode: a.barcode, code: a.code, name: a.name}));
    if (matches.length === 1) {
      const a = matches[0];
      setScanMatches([]);
      navigate(a.kind === 'SET' ? `/sets/${a.id}` : `/tools/${a.id}`);
      return;
    }
    setScanMatches(matches);
  };
  const sidebar = (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">S</div>
        <div>
          <strong>SurgiTrack</strong>
          <span>Trace Every Instrument</span>
        </div>
        <button className="icon-btn mobile-sidebar-close" onClick={() => setMobileOpen(false)}>
          <X size={18} />
        </button>
      </div>
      {isDemo && (
        <div className="demo-exit-panel">
          <span>DEMO</span>
          <button onClick={returnFromDemo}>
            {lang === 'el' ? '← Επιστροφή στη Διαχείριση' : '← Back to Platform Admin'}
          </button>
        </div>
      )}
      <div className="workspace-label">
        <small>{lang === 'el' ? 'ΧΩΡΟΣ ΕΡΓΑΣΙΑΣ' : 'WORKSPACE'}</small>
        <strong>
          {role === 'DEPARTMENT'
            ? `${roleLabel[role][lang]} · ${trData(currentUser.department)}`
            : platformOnly
              ? lang === 'el'
                ? 'Διαχείριση πλατφόρμας'
                : 'Platform administration'
              : role === 'ADMIN' && actingAsPlatformOwner()
                ? lang === 'el'
                  ? 'Owner πλατφόρμας'
                  : 'Platform owner'
                : role === 'STERILIZATION' && currentUser.supervisor
                  ? lang === 'el'
                    ? 'Προϊστάμενος Αποστείρωσης'
                    : 'Sterilization supervisor'
                  : roleLabel[role][lang]}
        </strong>
      </div>
      <nav>
        {navigation.map(item => {
          const [path, query = ''] = item.to.split('?');
          const active =
            location.pathname === path &&
            ((item.exactSearch ?? query) === ''
              ? location.search === ''
              : location.search.slice(1) === (item.exactSearch ?? query));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={() => setMobileOpen(false)}
              className={active ? 'nav-item active' : 'nav-item'}
            >
              <item.icon size={18} />
              <span>{lang === 'en' ? navEN[item.label] || item.label : item.label}</span>
              {item.to === '/hospital' && accessRequests > 0 && <em className="nav-badge">{accessRequests}</em>}
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <span>Healthcare Suite ready</span>
        <small>
          v{APP_VERSION} · {APP_EDITION}
        </small>
      </div>
    </aside>
  );
  return (
    <div
      className={`app-shell ${assetDetailMode ? 'asset-focus-shell' : ''} ${departmentMode ? 'department-shell' : ''}`}
    >
      {sidebar}
      {mobileOpen && <button className="mobile-sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobileOpen(true)}>
            <Menu size={19} />
          </button>
          <button
            className="suite-switcher"
            onClick={() => navigate('/')}
            title={lang === 'el' ? 'Αρχική χώρου εργασίας' : 'Workspace home'}
          >
            <Home size={15} />
            <span>SurgiTrack</span>
          </button>
          {!platformOnly && (
            <div className="global-scan-wrap">
              <form
                className="global-scan"
                onSubmit={e => {
                  e.preventDefault();
                  runGlobalSearch();
                }}
              >
                <Search size={16} />
                <input
                  value={scan}
                  onChange={e => {
                    setScan(e.target.value);
                    if (!e.target.value.trim()) setScanMatches([]);
                  }}
                  placeholder={lang === 'el' ? 'Scan / αναζήτηση S..., T...' : 'Scan / search S..., T...'}
                />
              </form>
              {scanMatches.length > 1 && (
                <div className="global-scan-results">
                  {scanMatches.map(a => (
                    <button
                      key={`${a.kind}-${a.id}`}
                      onClick={() => {
                        setScanMatches([]);
                        setScan('');
                        navigate(a.kind === 'SET' ? `/sets/${a.id}` : `/tools/${a.id}`);
                      }}
                    >
                      <strong className="mono">{a.barcode}</strong>
                      <span>{a.name}</span>
                      <small>{a.code}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <RoleSwitcher />
          {syncStatus !== 'saved' && (
            <span className={`sync-status ${syncStatus}`} role="status">
              {syncStatus === 'saving'
                ? lang === 'el'
                  ? 'Αποθήκευση…'
                  : 'Saving…'
                : lang === 'el'
                  ? 'Δεν αποθηκεύτηκε · νέα προσπάθεια'
                  : 'Not saved · retrying'}
            </span>
          )}
          <div className="top-actions">
            <button className="lang" onClick={() => setLang(lang === 'el' ? 'en' : 'el')}>
              {lang === 'el' ? 'EN' : 'EL'}
            </button>
            <button
              className="icon-btn help-btn"
              onClick={() => setHelpOpen(true)}
              title={lang === 'el' ? 'Κέντρο Βοήθειας & Πληροφοριών' : 'Help & Information Center'}
              aria-label={lang === 'el' ? 'Κέντρο Βοήθειας & Πληροφοριών' : 'Help & Information Center'}
            >
              <BookOpen size={18} />
            </button>
            <div className="a11y-wrap">
              <button
                className="icon-btn"
                onClick={() => setA11y(v => !v)}
                title={lang === 'el' ? 'Προσβασιμότητα' : 'Accessibility'}
              >
                <Accessibility size={18} />
              </button>
              {a11y && (
                <div className="a11y-popover">
                  <strong>{lang === 'el' ? 'Προσβασιμότητα' : 'Accessibility'}</strong>
                  <div className="a11y-row">
                    <span>{lang === 'el' ? 'Μέγεθος κειμένου' : 'Text size'}</span>
                    <div>
                      <button onClick={() => setFontScale(Math.max(0.9, fontScale - 0.1))}>
                        <Minus size={14} />
                      </button>
                      <button onClick={() => setFontScale(Math.min(1.25, fontScale + 0.1))}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <label>
                    <input type="checkbox" checked={highContrast} onChange={e => setHighContrast(e.target.checked)} />
                    {lang === 'el' ? 'Υψηλή αντίθεση' : 'High contrast'}
                  </label>
                  <label>
                    <input type="checkbox" checked={reducedMotion} onChange={e => setReducedMotion(e.target.checked)} />
                    {lang === 'el' ? 'Μειωμένη κίνηση' : 'Reduced motion'}
                  </label>
                </div>
              )}
            </div>
            <div className="notification-wrap">
              <button
                className="icon-btn notification-btn"
                onClick={() => setNotificationOpen(v => !v)}
                aria-label={lang === 'el' ? 'Ειδοποιήσεις' : 'Notifications'}
              >
                <Bell size={18} />
                {openNotifications > 0 && <span>{openNotifications}</span>}
              </button>
              {notificationOpen && (
                <div className="notification-popover">
                  <header>
                    <strong>{lang === 'el' ? 'Ειδοποιήσεις' : 'Notifications'}</strong>
                    <button onClick={() => setNotificationOpen(false)}>
                      <X size={15} />
                    </button>
                  </header>
                  {role === 'DEPARTMENT' ? (
                    <div className="notification-list">
                      {departmentReady.map(a => (
                        <button
                          key={`ready-${a.id}`}
                          className="notification-item ready"
                          onClick={() => {
                            setNotificationOpen(false);
                            navigate(a.barcode.startsWith('S') ? `/sets/${a.id}` : `/tools/${a.id}`);
                          }}
                        >
                          <PackageCheck size={17} />
                          <span>
                            <strong>
                              {a.barcode} · {a.name}
                            </strong>
                            <small>
                              {lang === 'el'
                                ? 'Έτοιμο για παραλαβή από την Αποστείρωση'
                                : 'Ready for pickup from Sterilization'}
                            </small>
                          </span>
                        </button>
                      ))}
                      {departmentIssues.slice(0, 5).map(i => (
                        <button
                          key={i.id}
                          className="notification-item"
                          onClick={() => {
                            setNotificationOpen(false);
                            navigate('/issues');
                          }}
                        >
                          <TriangleAlert size={17} />
                          <span>
                            <strong>{i.asset}</strong>
                            <small>{trData(i.type)}</small>
                          </span>
                        </button>
                      ))}
                      {departmentUsage.slice(0, 5).map(a => (
                        <button
                          key={a.id}
                          className="notification-item"
                          onClick={() => {
                            setNotificationOpen(false);
                            navigate('/department');
                          }}
                        >
                          <Gauge size={17} />
                          <span>
                            <strong>
                              {a.barcode} · {a.name}
                            </strong>
                            <small>
                              {lang === 'el' ? `${a.remaining} χρήσεις απομένουν` : `${a.remaining} uses remaining`}
                            </small>
                          </span>
                        </button>
                      ))}
                      {openNotifications === 0 && (
                        <div className="notification-empty">
                          {lang === 'el' ? 'Δεν υπάρχουν νέες ειδοποιήσεις.' : 'No new notifications.'}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {accessRequests > 0 && (
                        <div className="notification-list">
                          <button
                            className="notification-item ready"
                            onClick={() => {
                              setNotificationOpen(false);
                              navigate('/hospital');
                            }}
                          >
                            <UserPlus size={17} />
                            <span>
                              <strong>
                                {lang === 'el'
                                  ? `${accessRequests} ${accessRequests === 1 ? 'αίτημα' : 'αιτήματα'} πρόσβασης`
                                  : `${accessRequests} access ${accessRequests === 1 ? 'request' : 'requests'}`}
                              </strong>
                              <small>{lang === 'el' ? 'Αναμένουν την έγκρισή σας' : 'Waiting for your approval'}</small>
                            </span>
                          </button>
                        </div>
                      )}
                      {outOfUseNotices.length > 0 && (
                        <div className="notification-list">
                          {outOfUseNotices.slice(0, 8).map(t => (
                            <div key={`out-${t.id}`} className="notification-item out-of-use">
                              <Gauge size={17} />
                              <span>
                                <strong>
                                  {t.barcode} · {t.name}
                                </strong>
                                <small>
                                  {lang === 'el'
                                    ? `Εκτός χρήσης · ${trData(t.retiredReason || '')} · ${t.retiredAt || ''}`
                                    : `Out of use · ${trData(t.retiredReason || '')} · ${t.retiredAt || ''}`}
                                </small>
                              </span>
                              <button type="button" onClick={() => acknowledgeOutOfUse(t.id)}>
                                {lang === 'el' ? 'Ενημερώθηκα' : 'Got it'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="notification-empty">
                        {openNotifications - accessRequests - outOfUseNotices.length
                          ? lang === 'el'
                            ? `${openNotifications - accessRequests - outOfUseNotices.length} ενεργές ειδοποιήσεις`
                            : `${openNotifications - accessRequests - outOfUseNotices.length} active notifications`
                          : lang === 'el'
                            ? 'Δεν υπάρχουν νέες ειδοποιήσεις.'
                            : 'No new notifications.'}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="avatar">AF</div>
            <button className="icon-btn" onClick={onLogout} title={lang === 'el' ? 'Αποσύνδεση' : 'Sign out'}>
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <section className="content" ref={contentRef}>
          {children}
        </section>
        <footer>© 2026 SurgiTrack · Healthcare Suite</footer>
      </main>
      {helpOpen && (
        <Suspense fallback={null}>
          <HelpCenter onClose={() => setHelpOpen(false)} screens={navigation.map(item => item.to)} />
        </Suspense>
      )}
      {toast && (
        <div className="toast">
          <strong>{lang === 'el' ? 'Ολοκληρώθηκε' : 'Completed'}</strong>
          <span>{toast.text}</span>
          <button onClick={clearToast}>
            <X size={16} />
          </button>
        </div>
      )}
      {!toast && departmentReadyToast && role === 'DEPARTMENT' && (
        <div className="toast department-ready-toast">
          <strong>{lang === 'el' ? 'Έτοιμο για παραλαβή' : 'Ready for pickup'}</strong>
          <span>{departmentReadyToast.text}</span>
          <button onClick={() => setDepartmentReadyToast(undefined)}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
