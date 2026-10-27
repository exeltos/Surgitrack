import {Fragment, Suspense, useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {NavLink, useLocation} from 'react-router-dom';
import {useGuardedNavigate, useLeave} from '../../app/UnsavedChanges';
import {
  Accessibility,
  Bell,
  BookOpen,
  FlaskConical,
  Home,
  LogOut,
  Menu,
  Minus,
  Plus,
  ScanBarcode,
  X,
  Eye,
  Undo2,
  WifiOff,
} from 'lucide-react';
import BrandMark from './BrandMark';
import RecycleBinIcon from './RecycleBinIcon';
import {isExpired} from '../../core/recycleBin';
import {expiryAlerts, sterileExpiryList} from '../../core/sterileExpiry';
import {navSectionFor, navigationFor, navigationGroupLabel, ownerNavigation} from '../../config/navigation';
import {isPlatformOnly} from '../../core/platformOnly';
import {isOwnerOnlyPath, isOwnerOnlyTab} from '../../core/ownerOnlySections';
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
import {APP_VERSION} from '../../config/appMeta';
import {tr} from '../../i18n';
import {useListMemory} from '../../core/listMemory';
import {lazyPage} from '../../core/resilience';
import {formatDate, formatTime} from '../../core/displayDate';

// The user manual is loaded only when first opened.
import NotificationPanel from './NotificationPanel';
import OwnerDemoAlerts from './OwnerDemoAlerts';
import {enterPlatformDemo} from '../../data/cloud/platformDemo';
import {tellUser} from '../ui/confirmService';
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
  'Μεμονωμένα εργαλεία': 'Standalone instruments',
  Αρχική: 'Home',
  Μεμονωμένα: 'Standalone',
  'Απόθεμα εργαλείων': 'Instrument Stock',
  Εκκρεμότητες: 'Issues',
  Αναφορές: 'Reports',
  Ιστορικό: 'History',
  Κάδος: 'Recycle bin',
  'SurgiTrack Studio': 'SurgiTrack Studio',
  Ιχνηλάτηση: 'Traceability',
  Χρήστες: 'Users',
  'Demo αξιολόγησης': 'Evaluation Demos',
  Εισαγωγή: 'Import',
  Ειδοποιήσεις: 'Notices',
  Αξιολογήσεις: 'Ratings',
  Σφάλματα: 'Errors',
  Βιβλιοθήκες: 'Libraries',
  'Ροή Αποστείρωσης': 'Sterilization Flow',
  'Ρόλοι & δικαιώματα': 'Roles & permissions',
  Ρυθμίσεις: 'Settings',
  'Χρήστες & Τμήματα': 'Users & departments',
  Νοσοκομεία: 'Hospitals',
  Επισκόπηση: 'Overview',
  Λήξεις: 'Expiry',
};
/** Pages the platform admin can use without having entered a hospital. */
const PLATFORM_ONLY_PAGES = ['/studio', '/hospitals'];
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
  const [enteringDemo, setEnteringDemo] = useState(false);
  // After signing in: first what changed in this version, then what waits today (one at a time).
  // A moment after the screen opens, so that counts loaded alongside (access requests) are in.
  const [sinceSignIn, setSinceSignIn] = useState<'pending' | 'news' | 'briefing' | ''>('pending');
  useEffect(() => {
    const timer = window.setTimeout(
      // An evaluation Demo has its own welcome: no release notes or daily briefing over it.
      () => setSinceSignIn(evaluationDemo ? '' : whatsNewDue(can) ? 'news' : briefingDue() ? 'briefing' : ''),
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
  const platformOnly = isPlatformOnly();
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
      ? // The owner's own menu: each Studio section is an entry.
        ownerNavigation.filter(item => can(item.permission))
      : navigationFor(role, can)
  )
    .filter(item => item.to !== '/hospital' || hospitalAdmin)
    // The list of all hospitals is the platform admin's, outside Demo.
    .filter(item => item.to !== '/studio?tab=platform' || actingAsPlatformOwner())
    // So are the Sterilization flow, the roles & permissions and the settings: a hospital admin works within them.
    .filter(item => !isOwnerOnlyPath(item.to) || actingAsPlatformOwner());
  // The pages the menu reaches, for Help: a Studio section is the Studio page, and its hospitals list is
  // what the Hospitals help describes.
  const helpScreens = [
    ...new Set(
      navigation.flatMap(item =>
        item.to === '/studio?tab=platform' ? ['/studio', '/hospitals'] : [item.to.split('?')[0]],
      ),
    ),
  ];
  useEffect(() => {
    // The Studio opens on a section, so one menu entry is always lit: the platform's overview outside a
    // hospital, the hospital's libraries inside one.
    const studioTab = new URLSearchParams(location.search).get('tab');
    if (location.pathname === '/studio' && !studioTab)
      navigate(platformOnly ? '/studio?tab=overview' : '/studio?tab=libraries', {replace: true});
    else if (location.pathname === '/studio' && isOwnerOnlyTab(studioTab) && !actingAsPlatformOwner())
      navigate('/studio?tab=libraries', {replace: true});
    else if (platformOnly && !PLATFORM_ONLY_PAGES.some(page => location.pathname.startsWith(page)))
      navigate('/studio?tab=overview', {replace: true});
  }, [platformOnly, location.pathname, location.search, navigate]);
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
  const departmentMode = location.pathname === '/department' || location.pathname === '/department/tools';
  const sidebar = (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand">
        <BrandMark className="brand-mark" />
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
      <nav>
        {navigation
          .filter(item => item.to !== '/bin')
          .map((item, index, shown) => {
            // A short title where a new section of the menu starts (only when the menu has more than one).
            const sections = new Set(shown.map(entry => entry.group).filter(Boolean)).size;
            const startsSection = sections > 1 && item.group && item.group !== shown[index - 1]?.group;
            const [path, query = ''] = item.to.split('?');
            const active =
              (location.pathname === path &&
                ((item.exactSearch ?? query) === ''
                  ? location.search === ''
                  : location.search.slice(1) === (item.exactSearch ?? query))) ||
              (query === '' && navSectionFor(location.pathname, toolModeOf) === path);
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                end
                onClick={() => setMobileOpen(false)}
                // The link's own match ignores the query, which would light every Studio section at once.
                className={() => (active ? 'nav-item active' : 'nav-item')}
              >
                <item.icon size={18} />
                <span>{lang === 'en' ? navEN[item.label] || item.label : item.label}</span>
                {item.to === '/hospital' && accessRequests > 0 && <em className="nav-badge">{accessRequests}</em>}
              </NavLink>
            );
            if (!startsSection || !item.group) return link;
            const [el, en] = navigationGroupLabel[item.group];
            return (
              <Fragment key={item.to}>
                <span className={index ? 'nav-group' : 'nav-group first'}>{lang === 'en' ? en : el}</span>
                {link}
              </Fragment>
            );
          })}
      </nav>
      {binItem && (
        // The recycle bin sits at the bottom right of the menu, as an icon: full when something was deleted.
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
        </NavLink>
      )}
      <div className="sidebar-foot">
        <small>{lang === 'el' ? `Έκδοση ${APP_VERSION}` : `Version ${APP_VERSION}`}</small>
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
          {/* In the platform's Demo the role is picked in the DEMO line. */}
          {!isDemo && <RoleSwitcher />}
          {/* The owner in Studio opens the platform's own Demo from the header (as in Limoxis). */}
          {platformOnly && !isDemo && can('studio.manage') && (
            <button
              type="button"
              className="header-demo-enter"
              title={tr('Είσοδος Demo')}
              aria-label={tr('Είσοδος Demo')}
              disabled={enteringDemo}
              onClick={() => {
                setEnteringDemo(true);
                void enterPlatformDemo('ADMIN').then(error => {
                  if (error === undefined) return;
                  setEnteringDemo(false);
                  void tellUser(tr('Είσοδος Demo'), error || tr('Δεν ήταν δυνατή η είσοδος στο Demo.'));
                });
              }}
            >
              <FlaskConical size={15} />
              <span>{tr('Είσοδος Demo')}</span>
            </button>
          )}
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
                <NotificationPanel
                  role={role}
                  lang={lang}
                  notices={{
                    departmentReady,
                    departmentIssues,
                    departmentExpiry,
                    departmentUsage,
                    accessRequests,
                    expiryNotices,
                    outOfUseNotices,
                    openIssues,
                    lifecycleAlerts,
                    openNotifications,
                  }}
                  onAcknowledgeOutOfUse={acknowledgeOutOfUse}
                  onClose={() => setNotificationOpen(false)}
                />
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
        {/* The platform's own Demo: a slim line above the content (as the evaluators' Demo bar), not a box
            in the menu. */}
        {isDemo && !evaluationDemo && (
          <div className="demo-bar owner-demo-bar" role="status">
            <span className="demo-bar-chip">
              <FlaskConical size={14} /> DEMO
            </span>
            <span className="demo-bar-text">
              {lang === 'el'
                ? 'Δοκιμαστικό νοσοκομείο · τα ίδια δεδομένα με τα Demo των αξιολογητών'
                : 'Sample hospital · the same data as the evaluators’ Demos'}
            </span>
            <div className="owner-demo-role">
              <Eye size={14} aria-hidden="true" />
              <span>{lang === 'el' ? 'Ρόλος' : 'Role'}</span>
              <RoleSwitcher />
            </div>
            <button
              type="button"
              className="demo-bar-action"
              onClick={returnFromDemo}
              aria-label={lang === 'el' ? 'Έξοδος από Demo' : 'Exit Demo'}
              title={lang === 'el' ? 'Έξοδος από Demo' : 'Exit Demo'}
            >
              <LogOut size={15} />
              <span>{lang === 'el' ? 'Έξοδος από Demo' : 'Exit Demo'}</span>
            </button>
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
          {/* In an evaluation Demo the first steps' guided tours explain each screen instead. */}
          {sinceSignIn === '' && !evaluationDemo && (
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
        <footer>© 2026 SurgiTrack</footer>
      </main>
      {helpOpen && (
        <Suspense fallback={null}>
          <HelpCenter onClose={() => setHelpOpen(false)} screens={helpScreens} />
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
          screens={helpScreens}
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
      {/* On a phone: the scanning stations (receipt, loading, release, delivery, lookup), full screen. */}
      {!platformOnly && (
        <button type="button" className="scan-fab" onClick={() => navigate('/scan')}>
          <ScanBarcode size={22} /> {tr('Σάρωση')}
        </button>
      )}
      {/* The platform owner: a prospect finished signing up in a Demo, or sent its evaluation. */}
      {platformOnly && !isDemo && can('studio.manage') && <OwnerDemoAlerts />}
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
