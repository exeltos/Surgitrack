import {useState, type ReactNode} from 'react';
import {NavLink, useLocation, useNavigate} from 'react-router-dom';
import {
  Accessibility,
  Bell,
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
} from 'lucide-react';
import {navigationFor} from '../../config/navigation';
import {useSurgi, type UserRole} from '../../store/SurgiStore';
import {useAppPreferences} from '../../core/AppPreferences';
import {SURGITRACK_DATA_MODE} from '../../config/dataMode';
import {APP_VERSION, APP_EDITION} from '../../config/appMeta';
const roleLabel: Record<UserRole, {el: string; en: string}> = {
  DEPARTMENT: {el: 'Τμήμα · Χειρουργείο', en: 'Department · Operating Theatre'},
  STERILIZATION: {el: 'Κεντρική Αποστείρωση', en: 'Central Sterile Services'},
  ADMIN: {el: 'Διαχειριστής', en: 'Administrator'},
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
};
export default function AppShell({children, onLogout}: {children: ReactNode; onLogout?: () => void}) {
  const {issues, lifecycleAlerts, sets, tools, currentUser, toast, clearToast, role, setRole, can} = useSurgi();
  const {lang, setLang, fontScale, setFontScale, highContrast, setHighContrast, reducedMotion, setReducedMotion} =
    useAppPreferences();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [a11y, setA11y] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [scan, setScan] = useState('');
  const [scanMatches, setScanMatches] = useState<
    Array<{id: string; kind: 'SET' | 'TOOL'; barcode: string; code: string; name: string}>
  >([]);
  const navigate = useNavigate();
  const location = useLocation();
  const departmentAssets = [
    ...sets.filter(s => s.department === currentUser.department),
    ...tools.filter(t => t.department === currentUser.department && t.mode === 'STANDALONE'),
  ];
  const departmentReady = departmentAssets.filter(a => a.state === 'READY_FOR_PICKUP');
  const departmentIssues = issues.filter(i => i.status === 'OPEN' && i.department === currentUser.department);
  const departmentUsage = lifecycleAlerts.filter(a => departmentAssets.some(asset => asset.id === a.assetId));
  const openNotifications =
    role === 'DEPARTMENT'
      ? departmentReady.length + departmentIssues.length + departmentUsage.length
      : issues.filter(i => i.status === 'OPEN').length + lifecycleAlerts.length;
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
      navigate(exact.kind === 'SET' ? `/sets/${exact.id}` : `/tools/${exact.id}`);
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
  const changeRole = (next: UserRole) => {
    setRole(next);
    navigate('/');
    setMobileOpen(false);
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
      <div className="workspace-label">
        <small>{lang === 'el' ? 'ΧΩΡΟΣ ΕΡΓΑΣΙΑΣ' : 'WORKSPACE'}</small>
        <strong>{roleLabel[role][lang]}</strong>
      </div>
      <nav>
        {navigationFor(role, can).map(item => {
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
          {SURGITRACK_DATA_MODE === 'DEMO' && (
            <div className="role-switch">
              <select
                value={role}
                onChange={e => changeRole(e.target.value as UserRole)}
                title={lang === 'el' ? 'Εναλλαγή ρόλου μόνο για Demo' : 'Demo role switch'}
              >
                <option value="DEPARTMENT">{lang === 'el' ? 'Τμήμα' : 'Department'}</option>
                <option value="STERILIZATION">{lang === 'el' ? 'Αποστείρωση' : 'Sterilization'}</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          )}
          <div className="top-actions">
            <button className="lang" onClick={() => setLang(lang === 'el' ? 'en' : 'el')}>
              {lang === 'el' ? 'EN' : 'EL'}
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
                            <small>{i.type}</small>
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
                    <div className="notification-empty">
                      {openNotifications
                        ? lang === 'el'
                          ? `${openNotifications} ενεργές ειδοποιήσεις`
                          : `${openNotifications} active notifications`
                        : lang === 'el'
                          ? 'Δεν υπάρχουν νέες ειδοποιήσεις.'
                          : 'No new notifications.'}
                    </div>
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
        <section className="content">{children}</section>
        <footer>© 2026 SurgiTrack · Healthcare Suite</footer>
      </main>
      {toast && (
        <div className="toast">
          <strong>{lang === 'el' ? 'Ολοκληρώθηκε' : 'Completed'}</strong>
          <span>{toast.text}</span>
          <button onClick={clearToast}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
