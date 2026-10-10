import {Fragment, Suspense, useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {NavLink, useLocation} from 'react-router-dom';
import {useGuardedNavigate, useLeave} from '../../app/UnsavedChanges';
import {
  Accessibility,
  Bell,
  BookOpen,
  Home,
  LogOut,
  Menu,
  Minus,
  Plus,
  X,
  PackageCheck,
  TriangleAlert,
  Gauge,
  Eye,
  UserPlus,
  Undo2,
  CalendarClock,
  WifiOff,
} from 'lucide-react';
import RecycleBinIcon from './RecycleBinIcon';
import {isExpired} from '../../core/recycleBin';
import {expiryAlerts, formatExpiry, sterileExpiryList, type ExpiryEntry} from '../../core/sterileExpiry';
import {navSectionFor, navigationFor} from '../../config/navigation';
import {useSurgi} from '../../store/SurgiStore';
import {useAppPreferences} from '../../core/AppPreferences';
import {getRuntimeDataMode, setRuntimeDataMode} from '../../config/dataMode';
import RoleSwitcher from './RoleSwitcher';
import {actingAsPlatformOwner, getRealIdentity} from '../../data/cloud/identity';
import {ACCESS_REQUESTS_CHANGED, countPendingAccessRequests, managedHospitalId} from '../../data/cloud/accessRequests';
import {onSyncConflict, onSyncNotice, useSyncInfo, type SyncConflict} from '../../data/cloud/useAppRecordSync';
import {syncNoticeMessage} from './syncNoticeMessage';
import {fieldName} from '../../data/cloud/mergeConcurrent';
import IdleLock from './IdleLock';
import {useLibraries} from '../../core/LibraryStore';
import {DEFAULT_IDLE_LOCK_MINUTES} from '../../core/libraryTypes';
import {getCloudOrganizationId} from '../../data/cloud/appRecords';
import {useRealtimeLive} from '../../data/cloud/realtime';
import {useOnline} from '../../core/useOnline';
import {useTrial} from '../../data/cloud/trialContext';
import {useEvaluationDemo} from '../../data/cloud/demoContext';
import DemoBar from './DemoBar';
import MaintenanceStrip from './MaintenanceStrip';
import WhatsNewDialog, {whatsNewDue} from './WhatsNew';
import Briefing, {briefingDue} from './Briefing';
import ScreenGuide from './ScreenGuide';
import {APP_VERSION, APP_EDITION} from '../../config/appMeta';
import {tr, trData} from '../../i18n';
import {useListMemory} from '../../core/listMemory';
import {lazyPage} from '../../core/resilience';
import {formatDate, formatTime} from '../../core/displayDate';

// The user manual is loaded only when first opened.
const HelpCenter = lazyPage(() => import('../../core/help/HelpCenter'));
/** Initials of a name, e.g. "ΑΙΚΑΤΕΡΙΝΗ ΜΠΟΥΓΑ" → "ΑΜ". */
const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] || '';
  return (first + last).toLocaleUpperCase('el');
};
const navEN: Record<string, string> = {
  'Εξοπλισμός τμήματος': 'Department Equipment',
  Αποστείρωση: 'Sterilization',
  Συσκευές: 'Devices',
  Αντικαταστάσεις: 'Replacements',
  Εργαλεία: 'Instruments',
  'Σετ εργαλείων': 'Instrument Sets',
  Μεμονωμένα: 'Standalone',
  'Απόθεμα εργαλείων': 'Instrument Stock',
  Εκκρεμότητες: 'Issues',
  Αναφορές: 'Reports',
  Ιστορικό: 'History',
  Κάδος: 'Recycle bin',
  'SurgiTrack Studio': 'Management Center',
  'Σετ & Εργαλεία': 'Sets & Instruments',
  'Χρήστες & Τμήματα': 'Users & departments',
  Νοσοκομεία: 'Hospitals',
  Επισκόπηση: 'Overview',
  Λήξεις: 'Expiry',
};
/** Pages the platform admin can use without having entered a hospital. */
const PLATFORM_ONLY_PAGES = ['/studio', '/hospitals'];
const expiryText = (e: ExpiryEntry, lang: string) =>
  e.state === 'EXPIRED'
    ? lang === 'el'
      ? `Η αποστείρωση έληξε στις ${formatExpiry(e.sterileUntil)}`
      : `Sterility expired on ${formatExpiry(e.sterileUntil)}`
    : lang === 'el'
      ? `Η αποστείρωση λήγει στις ${formatExpiry(e.sterileUntil)} (${e.daysLeft} ημ.)`
      : `Sterility expires on ${formatExpiry(e.sterileUntil)} (${e.daysLeft} d)`;
export default function AppShell({
  children,
  onLogout,
}: {
  children: ReactNode;
  /** `direct`: no «Αποσύνδεση;» question (the user already chose to leave). */
  onLogout?: (direct?: boolean) => void;
}) {
  const trial = useTrial();
  const evaluationDemo = useEvaluationDemo();
  const {
    issues,
    lifecycleAlerts,
    sets,
    tools,
    retiredTools,
    recycleBin,
    acknowledgeOutOfUse,
    currentUser,
    toast,
    clearToast,
    role,
    can,
    organizationName,
  } = useSurgi();
  const syncInfo = useSyncInfo();
  const {systemSettings} = useLibraries();
  const idleLockMinutes = systemSettings.idleLockMinutes ?? DEFAULT_IDLE_LOCK_MINUTES;
  const syncStatus = syncInfo.status;
  const realtimeLive = useRealtimeLive();
  const online = useOnline();
  const {lang, setLang, fontScale, setFontScale, highContrast, setHighContrast, reducedMotion, setReducedMotion} =
    useAppPreferences();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [a11y, setA11y] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // After signing in: first what changed in this version, then what waits today (one at a time).
  // A moment after the screen opens, so that counts loaded alongside (access requests) are in.
  const [sinceSignIn, setSinceSignIn] = useState<'pending' | 'news' | 'briefing' | ''>('pending');
  useEffect(() => {
    const timer = window.setTimeout(
      () => setSinceSignIn(whatsNewDue(can) ? 'news' : briefingDue() ? 'briefing' : ''),
      1200,
    );
    return () => window.clearTimeout(timer);
    // Once per sign-in: the shell stays mounted while the person works.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const closeBriefing = useCallback(() => setSinceSignIn(''), []);
  const [departmentReadyToast, setDepartmentReadyToast] = useState<{id: string; text: string}>();
  // A record changed on two devices at once: say where the other device's value was kept (S4).
  const [conflict, setConflict] = useState<SyncConflict>();
  useEffect(() => onSyncConflict(setConflict), []);
  useEffect(() => {
    if (!conflict) return;
    const timer = window.setTimeout(() => setConflict(undefined), 15000);
    return () => window.clearTimeout(timer);
  }, [conflict]);
  // Barcodes the sync renumbered and changes the server refused: kept until closed (a label to reprint).
  const [notices, setNotices] = useState<Array<{title: string; text: string}>>([]);
  useEffect(() => onSyncNotice(notice => setNotices(list => [...list, syncNoticeMessage(notice)].slice(-3))), []);
  const navigate = useGuardedNavigate();
  const leave = useLeave();
  const logout = onLogout && (() => leave(() => onLogout()));
  // From the screen lock the user already chose to sign in as someone else: no second question.
  const switchUser = onLogout && (() => leave(() => onLogout(true)));
  const location = useLocation();
  const contentRef = useRef<HTMLElement>(null);
  useListMemory(contentRef);
  const isDemo = getRuntimeDataMode() === 'DEMO';
  // The platform admin belongs to no hospital, so outside Demo only Studio has anything to show.
  const platformOnly =
    !isDemo && !!getRealIdentity()?.platform && !sessionStorage.getItem('surgitrack-active-organization');
  // Hospital administration: a real hospital's admin working as Admin, or the Admin of Demo.
  const hospitalId = role === 'ADMIN' ? managedHospitalId() : undefined;
  const hospitalAdmin = !!hospitalId || (isDemo && role === 'ADMIN');
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
      ? // Studio first, the list of hospitals below it.
        PLATFORM_ONLY_PAGES.flatMap(page => navigationFor(role, can).filter(item => item.to === page))
      : navigationFor(role, can)
  )
    .filter(item => item.to !== '/hospital' || hospitalAdmin)
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
  const binItem = navigation.find(item => item.to === '/bin');
  const binLabel = lang === 'en' ? 'Recycle bin' : 'Κάδος';
  const binCount = recycleBin.filter(entry => !isExpired(entry)).length;
  const departmentAssets = [
    ...sets.filter(s => s.department === currentUser.department),
    ...tools.filter(t => t.department === currentUser.department && t.mode === 'STANDALONE'),
  ];
  const departmentReady = departmentAssets.filter(a => a.state === 'READY_FOR_PICKUP');
  // The person actually signed in, even while an admin views the app as another role.
  const signedInName = getRealIdentity()?.name || currentUser.name;
  const departmentIssues = issues.filter(i => i.status === 'OPEN' && i.department === currentUser.department);
  const departmentUsage = lifecycleAlerts.filter(a => departmentAssets.some(asset => asset.id === a.assetId));
  // Sterile Sets and instruments in their last month (10 days for 2 months) or expired.
  const expiryNotices = expiryAlerts(sterileExpiryList(sets, tools));
  const departmentExpiry = expiryNotices.filter(e => departmentAssets.some(asset => asset.id === e.id));
  const accessRequests = hospitalId ? pendingAccess : 0;
  const openIssues = issues.filter(i => i.status === 'OPEN');
  // Instruments that just ran out of lives: Sterilization must set them aside and confirm.
  const outOfUseNotices = role === 'DEPARTMENT' ? [] : retiredTools.filter(t => !t.retiredNoticeSeenAt);
  const openNotifications =
    role === 'DEPARTMENT'
      ? departmentReady.length + departmentIssues.length + departmentUsage.length + departmentExpiry.length
      : openIssues.length + lifecycleAlerts.length + accessRequests + outOfUseNotices.length + expiryNotices.length;
  const readyKey = departmentReady.map(asset => asset.id).join('|');
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
    // Keyed on the ids of the ready assets (readyKey), not on the array itself, which is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, currentUser.department, readyKey, lang]);
  const toolModeOf = (id: string) => tools.find(t => t.id === id)?.mode;
  const assetDetailMode = /^\/(tools|sets)\/[^/]+$/.test(location.pathname);
  const departmentMode = location.pathname === '/department';
  const sidebar = (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">S</div>
        <div>
          <strong>SurgiTrack</strong>
          <span>Trace Every Instrument</span>
        </div>
        <button
          className="icon-btn mobile-sidebar-close"
          onClick={() => setMobileOpen(false)}
          aria-label={lang === 'el' ? 'Κλείσιμο μενού' : 'Close menu'}
        >
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
      <nav>
        {navigation
          .filter(item => item.to !== '/bin')
          .map(item => {
            const [path, query = ''] = item.to.split('?');
            const active =
              (location.pathname === path &&
                ((item.exactSearch ?? query) === ''
                  ? location.search === ''
                  : location.search.slice(1) === (item.exactSearch ?? query))) ||
              (query === '' && navSectionFor(location.pathname, toolModeOf) === path);
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
      {binItem && (
        // The recycle bin sits at the bottom left, like a desktop bin: full when something was deleted.
        <NavLink
          to="/bin"
          end
          onClick={() => setMobileOpen(false)}
          className={location.pathname === '/bin' ? 'sidebar-bin active' : 'sidebar-bin'}
          aria-label={`${binLabel}${binCount ? ` · ${binCount}` : ''}`}
          title={binLabel}
        >
          <span className="sidebar-bin-icon">
            <RecycleBinIcon full={binCount > 0} />
            {binCount > 0 && <em>{binCount}</em>}
          </span>
          <span>{binLabel}</span>
        </NavLink>
      )}
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
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label={lang === 'el' ? 'Μενού' : 'Menu'}
          >
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
          <RoleSwitcher />
          {!!getCloudOrganizationId() && <SyncChip info={syncInfo} live={realtimeLive} online={online} />}
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
                  {/* On phones the language button leaves the top bar for room; it is here instead. */}
                  <div className="a11y-row a11y-lang">
                    <span>{lang === 'el' ? 'Γλώσσα' : 'Language'}</span>
                    <div>
                      <button className={lang === 'el' ? 'active' : ''} onClick={() => setLang('el')}>
                        EL
                      </button>
                      <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
                        EN
                      </button>
                    </div>
                  </div>
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
                aria-label={`${lang === 'el' ? 'Ειδοποιήσεις' : 'Notifications'}${openNotifications > 0 ? ` ${openNotifications}` : ''}`}
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
                      {departmentExpiry.slice(0, 5).map(e => (
                        <button
                          key={`exp-${e.kind}-${e.id}`}
                          className={`notification-item expiry ${e.state.toLowerCase()}`}
                          onClick={() => {
                            setNotificationOpen(false);
                            navigate(e.kind === 'SET' ? `/sets/${e.id}` : `/tools/${e.id}`);
                          }}
                        >
                          <CalendarClock size={17} />
                          <span>
                            <strong>
                              {e.barcode} · {e.name}
                            </strong>
                            <small>{expiryText(e, lang)}</small>
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
                      {expiryNotices.length > 0 && (
                        <div className="notification-list">
                          <span className="notification-group">
                            {lang === 'el' ? 'Λήξη αποστείρωσης' : 'Sterile expiry'} · {expiryNotices.length}
                          </span>
                          {expiryNotices.slice(0, 6).map(e => (
                            <button
                              key={`exp-${e.kind}-${e.id}`}
                              className={`notification-item expiry ${e.state.toLowerCase()}`}
                              onClick={() => {
                                setNotificationOpen(false);
                                navigate('/expiry');
                              }}
                            >
                              <CalendarClock size={17} />
                              <span>
                                <strong>
                                  {e.barcode} · {e.name}
                                </strong>
                                <small>{expiryText(e, lang)}</small>
                              </span>
                            </button>
                          ))}
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
                      {openIssues.length > 0 && (
                        <div className="notification-list">
                          <span className="notification-group">
                            {lang === 'el' ? 'Ανοιχτές εκκρεμότητες' : 'Open issues'} · {openIssues.length}
                          </span>
                          {openIssues.slice(0, 6).map(i => (
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
                                <small>
                                  {trData(i.type)} · {trData(i.department)} · {i.created}
                                </small>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {lifecycleAlerts.length > 0 && (
                        <div className="notification-list">
                          <span className="notification-group">
                            {lang === 'el' ? 'Λίγες χρήσεις απομένουν' : 'Few uses left'} · {lifecycleAlerts.length}
                          </span>
                          {lifecycleAlerts.slice(0, 6).map(a => (
                            <button
                              key={a.id}
                              className="notification-item"
                              onClick={() => {
                                setNotificationOpen(false);
                                navigate(a.assetKind === 'SET' ? `/sets/${a.assetId}` : `/tools/${a.assetId}`);
                              }}
                            >
                              <Gauge size={17} />
                              <span>
                                <strong>
                                  {a.barcode} · {a.name}
                                </strong>
                                <small>
                                  {lang === 'el'
                                    ? `${a.remaining} από ${a.maxUses} χρήσεις απομένουν`
                                    : `${a.remaining} of ${a.maxUses} uses left`}
                                </small>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {openNotifications === 0 ? (
                        <div className="notification-empty">
                          {lang === 'el' ? 'Δεν υπάρχουν νέες ειδοποιήσεις.' : 'No new notifications.'}
                        </div>
                      ) : (
                        openIssues.length > 6 && (
                          <button
                            className="notification-more"
                            onClick={() => {
                              setNotificationOpen(false);
                              navigate('/issues');
                            }}
                          >
                            {lang === 'el'
                              ? `Όλες οι εκκρεμότητες (${openIssues.length})`
                              : `All issues (${openIssues.length})`}
                          </button>
                        )
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="avatar" title={signedInName}>
              {initialsOf(signedInName)}
            </div>
            <button className="icon-btn" onClick={logout} title={lang === 'el' ? 'Αποσύνδεση' : 'Sign out'}>
              <LogOut size={17} />
            </button>
          </div>
        </header>
        {!online && (
          <div className="offline-strip" role="alert">
            <WifiOff size={18} aria-hidden="true" />
            <span>
              <strong>{tr('Χωρίς σύνδεση στο δίκτυο.')}</strong>{' '}
              {syncStatus === 'saved'
                ? tr(
                    'Ό,τι καταχωρίσετε κρατιέται σε αυτή τη συσκευή και αποθηκεύεται μόλις επανέλθει η σύνδεση· αλλαγές άλλων συσκευών δεν φαίνονται μέχρι τότε.',
                  )
                : tr(
                    'Οι τελευταίες αλλαγές κρατιούνται σε αυτή τη συσκευή και θα αποθηκευτούν μόλις επανέλθει η σύνδεση, ακόμη κι αν κλείσει η σελίδα: ανοίξτε την ξανά με τον ίδιο χρήστη.',
                  )}
            </span>
          </div>
        )}
        {evaluationDemo && (
          <DemoBar
            role={role}
            savedAt={syncInfo.status === 'saved' ? syncInfo.lastSyncAt : undefined}
            onShowMe={to => {
              navigate(to);
              setHelpOpen(true);
            }}
          />
        )}
        {!evaluationDemo && trial && (trial.warn || trial.ended) && (
          <div className={`trial-strip${trial.ended ? ' ended' : ''}`} role="status">
            {trial.ended
              ? lang === 'el'
                ? 'Η δοκιμαστική περίοδος έληξε: το νοσοκομείο είναι κλειδωμένο για τους χρήστες του μέχρι να το ανανεώσετε από το Studio.'
                : 'The trial has ended: the hospital is locked for its users until you renew it in Studio.'
              : lang === 'el'
                ? `Δοκιμαστική περίοδος: ${trial.daysLeft === 1 ? 'απομένει 1 ημέρα' : `απομένουν ${trial.daysLeft} ημέρες`} (λήγει ${formatDate(trial.endsAt || '')}). Μετά τη λήξη το νοσοκομείο κλειδώνει· για συνέχεια επικοινωνήστε με τον διαχειριστή του SurgiTrack.`
                : `Trial period: ${trial.daysLeft === 1 ? '1 day left' : `${trial.daysLeft} days left`} (ends ${formatDate(trial.endsAt || '')}). The hospital locks when it ends; to continue, contact the SurgiTrack administrator.`}
          </div>
        )}
        <MaintenanceStrip />
        {role === 'VIEWER' && (
          <div className="readonly-strip" role="status">
            <Eye size={15} />
            {lang === 'el'
              ? 'Μόνο προβολή: βλέπεις όλα τα δεδομένα, αλλά δεν μπορείς να τα αλλάξεις.'
              : 'View only: you can see all the data but not change it.'}
          </div>
        )}
        <section className="content" ref={contentRef}>
          {/* Not over the sign-in dialogs: once they are closed. */}
          {sinceSignIn === '' && (
            <ScreenGuide
              pathname={location.pathname}
              lang={lang === 'en' ? 'en' : 'el'}
              can={can}
              onHelp={() => setHelpOpen(true)}
              enabled={systemSettings.screenGuides !== false}
            />
          )}
          {children}
        </section>
        <footer>© 2026 SurgiTrack · Healthcare Suite</footer>
      </main>
      {helpOpen && (
        <Suspense fallback={null}>
          <HelpCenter onClose={() => setHelpOpen(false)} screens={navigation.map(item => item.to)} />
        </Suspense>
      )}
      {sinceSignIn === 'news' && (
        <WhatsNewDialog
          lang={lang === 'en' ? 'en' : 'el'}
          can={can}
          onClose={() => setSinceSignIn(briefingDue() ? 'briefing' : '')}
        />
      )}
      {sinceSignIn === 'briefing' && (
        <Briefing
          lang={lang === 'en' ? 'en' : 'el'}
          name={signedInName.split(' ')[0]}
          accessRequests={accessRequests}
          screens={navigation.map(item => item.to)}
          onOpen={to => {
            setSinceSignIn('');
            navigate(to);
          }}
          onClose={closeBriefing}
        />
      )}
      {toast && (
        <div className={`toast${toast.warning ? ' warning' : ''}`} role="status">
          <strong>
            {toast.warning ? (lang === 'el' ? 'Προσοχή' : 'Attention') : lang === 'el' ? 'Ολοκληρώθηκε' : 'Completed'}
          </strong>
          <span>{toast.text}</span>
          {toast.undo && (
            <button type="button" className="toast-undo" onClick={toast.undo}>
              <Undo2 size={14} /> {lang === 'el' ? 'Αναίρεση' : 'Undo'}
            </button>
          )}
          <button onClick={clearToast} aria-label={lang === 'el' ? 'Κλείσιμο' : 'Close'}>
            <X size={16} />
          </button>
        </div>
      )}
      {!toast && departmentReadyToast && role === 'DEPARTMENT' && (
        <div className="toast department-ready-toast" role="status">
          <strong>{lang === 'el' ? 'Έτοιμο για παραλαβή' : 'Ready for pickup'}</strong>
          <span>{departmentReadyToast.text}</span>
          <button onClick={() => setDepartmentReadyToast(undefined)} aria-label={lang === 'el' ? 'Κλείσιμο' : 'Close'}>
            <X size={16} />
          </button>
        </div>
      )}
      {conflict && (
        <div className="toast sync-conflict-toast" role="alert">
          <strong>{tr('Ταυτόχρονη αλλαγή από άλλη συσκευή')}</strong>
          <span>
            {tr(
              '{0}: κρατήθηκε η αλλαγή της άλλης συσκευής σε: {1}. Οι υπόλοιπες αλλαγές σας αποθηκεύτηκαν.',
              conflict.label,
              conflict.fields.map(field => fieldName(field, lang)).join(', '),
            )}
          </span>
          <button onClick={() => setConflict(undefined)} aria-label={lang === 'el' ? 'Κλείσιμο' : 'Close'}>
            <X size={16} />
          </button>
        </div>
      )}
      {notices.length > 0 && (
        <div className="toast sync-conflict-toast sync-notice-toast" role="alert">
          {notices.map((notice, index) => (
            <Fragment key={index}>
              <strong>{notice.title}</strong>
              <span>{notice.text}</span>
            </Fragment>
          ))}
          <button onClick={() => setNotices([])} aria-label={lang === 'el' ? 'Κλείσιμο' : 'Close'}>
            <X size={16} />
          </button>
        </div>
      )}
      <IdleLock
        minutes={idleLockMinutes}
        userName={signedInName}
        hospital={organizationName}
        onSwitchUser={switchUser}
      />
    </div>
  );
}

/** Top-bar sync state: live / periodic, records waiting to be saved, last contact with the server. */
function SyncChip({info, live, online}: {info: ReturnType<typeof useSyncInfo>; live: boolean; online: boolean}) {
  const last = info.lastSyncAt ? formatTime(info.lastSyncAt, true) : '—';
  const state =
    info.status === 'failed' ? 'failed' : info.status === 'saving' ? 'saving' : live && online ? 'live' : 'polling';
  const label =
    state === 'failed'
      ? tr('Δεν αποθηκεύτηκε · νέα προσπάθεια')
      : state === 'saving'
        ? info.pendingRecords
          ? tr('Αποθήκευση · {0} αλλαγές', info.pendingRecords)
          : tr('Αποθήκευση…')
        : state === 'live'
          ? tr('Ζωντανά')
          : tr('Συγχρονισμός');
  const title =
    state === 'live'
      ? tr('Ζωντανός συγχρονισμός: οι αλλαγές των άλλων συσκευών εμφανίζονται αμέσως. Τελευταία επικοινωνία: {0}', last)
      : state === 'polling'
        ? tr('Έλεγχος για αλλαγές κάθε 20 δευτερόλεπτα. Τελευταία επικοινωνία: {0}', last)
        : tr('Αλλαγές σε αναμονή αποθήκευσης: {0}. Τελευταία επικοινωνία: {1}', info.pendingRecords, last);
  return (
    <span className={`sync-status sync-chip ${state}`} role="status" title={title} aria-label={`${label}. ${title}`}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}
