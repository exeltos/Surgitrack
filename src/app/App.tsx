import {Suspense, useEffect, useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Routes, Route, Navigate, useLocation, useNavigate} from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import {UnsavedChangesProvider} from './UnsavedChanges';
import {ConfirmHost} from '../components/ui/confirmService';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import AuthIndex from '../modules/auth/AuthIndex';
import PendingAccess from '../modules/auth/PendingAccess';
import {useSurgi} from '../store/SurgiStore';
import {useAppPreferences} from '../core/AppPreferences';
import {roleHomePath, type Permission} from '../core/permissions';
import type {SessionUser} from '../store/types';
import {getRuntimeDataMode, setRuntimeDataMode} from '../config/dataMode';
import {clearPasswordRecovery, passwordRecoveryPending, supabase} from '../lib/supabase';
import {clearCache} from '../data/cloud/localCache';
import {clearIdleLock} from '../components/layout/idleLockState';
import {hospitalOverviewAvailable} from '../data/cloud/hospitalSwitch';
import {homePathFor} from '../config/navigation';
import Spinner from '../components/ui/Spinner';
import {lazyPage} from '../core/resilience';
import NotFoundPage from '../modules/NotFoundPage';
import RouteErrorBoundary from '../components/layout/RouteErrorBoundary';
import {useSignOutGuard} from './useSignOutGuard';
import {SCAN_PATH, isScanStandalone, onScanScreens} from '../modules/scan/scanApp';
import {
  type AccessRequest,
  canViewAs,
  clearIdentity,
  productionOrganizationFor,
  resolveIdentity,
  sessionUserFor,
} from '../data/cloud/identity';

// Route pages are code-split so the sign-in screen and each workspace load only what they need.
const SetsPage = lazyPage(() => import('../modules/sets/SetsPage'));
const SetDetailPage = lazyPage(() => import('../modules/sets/SetDetailPage'));
const ToolsPage = lazyPage(() => import('../modules/tools/ToolsPage'));
const ToolDetailPage = lazyPage(() => import('../modules/tools/ToolDetailPage'));
const AssetCreatePage = lazyPage(() => import('../components/assets/AssetCreatePage'));
const StandaloneToolsPage = lazyPage(() => import('../modules/tools/StandaloneToolsPage'));
const StockPage = lazyPage(() => import('../modules/stock/StockPage'));
const BinPage = lazyPage(() => import('../modules/bin/BinPage'));
const SterileExpiryPage = lazyPage(() => import('../modules/expiry/SterileExpiryPage'));
const SterilizationPage = lazyPage(() => import('../modules/sterilization/SterilizationPage'));
const DevicesPage = lazyPage(() => import('../modules/devices/DevicesPage'));
const ImportPage = lazyPage(() => import('../modules/import/ImportPage'));
const NameCheckPage = lazyPage(() => import('../modules/tools/NameCheckPage'));
const DepartmentPage = lazyPage(() => import('../modules/department/DepartmentPage'));
const IssuesPage = lazyPage(() => import('../modules/issues/IssuesPage'));
const MovementsPage = lazyPage(() => import('../modules/movements/MovementsPage'));
const TraceabilityPage = lazyPage(() => import('../modules/traceability/TraceabilityPage'));
const ReportsPage = lazyPage(() => import('../modules/reports/ReportsPage'));
const StudioPage = lazyPage(() => import('../modules/studio/StudioPage'));
const HospitalAdminPage = lazyPage(() => import('../modules/hospital/HospitalAdminPage'));
const HospitalOverviewPage = lazyPage(() => import('../modules/hospital/HospitalOverviewPage'));
const JoinPage = lazyPage(() => import('../modules/auth/JoinPage'));
const ScanApp = lazyPage(() => import('../modules/scan/ScanApp'));

const readDemoSessionUser = (): SessionUser | undefined => {
  try {
    const user = JSON.parse(sessionStorage.getItem('surgitrack-session-user') || 'null') as SessionUser | null;
    return user?.id && user.role && user.role === sessionStorage.getItem('surgitrack-demo-role') ? user : undefined;
  } catch {
    return undefined;
  }
};

function RoleHome() {
  const {role, can} = useSurgi();
  // An admin outside a hospital (the platform owner) starts in Studio; everyone else on their menu's home.
  const home =
    role === 'ADMIN' && !hospitalOverviewAvailable()
      ? roleHomePath(role)
      : homePathFor(role, can) || roleHomePath(role);
  return <Navigate to={home} replace />;
}
const Guard = ({permission, children}: {permission: Permission | Permission[]; children: ReactNode}) => (
  <ProtectedRoute permission={permission}>
    <RouteErrorBoundary>
      <Suspense fallback={<Spinner />}>{children}</Suspense>
    </RouteErrorBoundary>
  </ProtectedRoute>
);
/** «Ιστορικό» is a tab of Traceability for whoever has Traceability; a department keeps its own page. */
function MovementsRoute() {
  const {can} = useSurgi();
  return can('traceability.view') ? <Navigate to="/traceability?tab=history" replace /> : <MovementsPage />;
}

export default function App() {
  const {setSessionUser, sessionReady, currentUser} = useSurgi();
  const {lang} = useAppPreferences();
  const navigate = useNavigate();
  const location = useLocation();
  const [authenticated, setAuthenticated] = useState(false);
  const [accessRequest, setAccessRequest] = useState<AccessRequest>();
  const [authReady, setAuthReady] = useState(false);
  const [goodbye, setGoodbye] = useState('');
  const [passwordRecovery, setPasswordRecovery] = useState(
    () => passwordRecoveryPending() || /type=(recovery|invite)/.test(window.location.hash),
  );
  const recoveryRef = useRef(passwordRecovery);
  const [signOutGuard, guardSignOut] = useSignOutGuard();
  useEffect(() => {
    recoveryRef.current = passwordRecovery;
  }, [passwordRecovery]);
  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      // Wait a moment for the client to finish reading a reset link from the URL.
      await supabase.auth.getSession();
      if (recoveryRef.current || passwordRecoveryPending() || /type=(recovery|invite)/.test(window.location.hash)) {
        setPasswordRecovery(true);
        setAuthenticated(false);
        setAuthReady(true);
        return;
      }
      const result = await resolveIdentity();
      if (!mounted) return;
      if (result.status === 'pending') {
        setAccessRequest(result.request);
        setAuthenticated(false);
        setAuthReady(true);
        return;
      }
      if (result.status !== 'ok') {
        if (result.status === 'inactive') {
          await supabase.auth.signOut();
          clearIdentity();
        }
        setAuthenticated(false);
        setAuthReady(true);
        return;
      }
      const identity = result.identity;
      let user: SessionUser = sessionUserFor(identity);
      // Keep the role picked in the header across reloads: any role in Demo, and for admins
      // "view as" in their hospital (the platform admin only once a hospital is picked).
      const chosen = readDemoSessionUser();
      if (getRuntimeDataMode() === 'DEMO') {
        if (identity.platform && chosen) user = chosen;
      } else if (canViewAs(identity) && chosen?.viewAs && productionOrganizationFor(identity)) {
        user = chosen;
      }
      const role = user.role;
      sessionStorage.setItem('surgitrack-auth', '1');
      sessionStorage.setItem('surgitrack-demo-role', role);
      sessionStorage.setItem('surgitrack-session-user', JSON.stringify(user));
      setSessionUser(user);
      setAuthenticated(true);
      setAuthReady(true);
    };
    void restoreSession();
    const {data: listener} = supabase.auth.onAuthStateChange(event => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setAuthenticated(false);
        setAuthReady(true);
        return;
      }
      if (event === 'SIGNED_OUT') {
        setAuthenticated(false);
        setAuthReady(true);
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [setSessionUser]);
  // After sign-in the page reloads so the workspace gate can load the user's hospital.
  const login = () => {
    // Signing in normally ends any unfinished password reset in this tab.
    clearPasswordRecovery();
    sessionStorage.setItem('surgitrack-auth', '1');
    sessionStorage.removeItem('surgitrack-session-user');
    sessionStorage.removeItem('surgitrack-view-as');
    // Signed in from the phone app (or its screens): back to scanning, not to the full app.
    window.location.hash = onScanScreens() ? `#${SCAN_PATH}` : '#/';
    window.location.reload();
  };
  // Asked in the app, after what is still unsaved has had a chance to reach the server (see useSignOutGuard).
  const logout = (direct?: boolean) => guardSignOut(() => void signOut(), {direct});
  const signOut = async () => {
    const msg =
      lang === 'el'
        ? `Καλή συνέχεια, ${currentUser.name.split(' ')[0]}.`
        : `See you soon, ${currentUser.name.split(' ')[0]}.`;
    const wasDemo = sessionStorage.getItem('surgitrack-data-mode') === 'DEMO';
    // This device's copy of the hospital (patient codes included) goes with the session.
    await clearCache();
    clearIdleLock();
    if (!wasDemo) await supabase.auth.signOut();
    sessionStorage.removeItem('surgitrack-auth');
    sessionStorage.removeItem('surgitrack-demo-role');
    sessionStorage.removeItem('surgitrack-session-user');
    sessionStorage.removeItem('surgitrack-active-organization');
    if (!wasDemo) clearIdentity();
    setRuntimeDataMode('PRODUCTION');
    if (wasDemo) {
      window.location.hash = '#/';
      window.location.reload();
      return;
    }
    setGoodbye(msg);
    setAuthenticated(false);
    navigate(onScanScreens() ? SCAN_PATH : '/', {replace: true});
  };
  // A hospital's signup link is public: it works signed in or not.
  const joinToken = /^\/join\/([0-9a-f]{16,})$/.exec(location.pathname)?.[1];
  // The emailed link that confirms a signup's email (also public).
  const confirmToken = /^\/join\/confirm\/([0-9a-f]{16,})$/.exec(location.pathname)?.[1];
  if (joinToken || confirmToken)
    return (
      <Suspense fallback={<Spinner fullScreen />}>
        <JoinPage token={(joinToken || confirmToken)!} confirm={!!confirmToken} />
      </Suspense>
    );
  if (!authReady) return <Spinner fullScreen />;
  if (accessRequest)
    return (
      <PendingAccess
        request={accessRequest}
        onSignOut={async () => {
          await supabase.auth.signOut();
          clearIdentity();
          sessionStorage.removeItem('surgitrack-auth');
          setAccessRequest(undefined);
          navigate('/', {replace: true});
        }}
      />
    );
  if (!authenticated)
    return (
      <AuthIndex
        scan={onScanScreens()}
        onAuthenticated={login}
        goodbye={goodbye}
        passwordRecovery={passwordRecovery}
        onPasswordRecoveryHandled={() => {
          clearPasswordRecovery();
          setPasswordRecovery(false);
        }}
      />
    );
  // Never show (or act as) a stand-in person outside Demo: wait until the store has the signed-in user.
  if (!sessionReady) return <Spinner fullScreen />;
  const signOutLayer = createPortal(
    <div className="sign-out-guard">
      {signOutGuard}
      <ConfirmHost />
    </div>,
    document.body,
  );
  // The phone app: only the scanning stations, without the menu and pages of the full app.
  if (isScanStandalone() || location.pathname === SCAN_PATH || location.pathname.startsWith(`${SCAN_PATH}/`))
    return (
      <UnsavedChangesProvider>
        <RouteErrorBoundary>
          <Suspense fallback={<Spinner fullScreen />}>
            <ScanApp key={lang} onLogout={logout} />
          </Suspense>
        </RouteErrorBoundary>
        {signOutLayer}
      </UnsavedChangesProvider>
    );
  return (
    <UnsavedChangesProvider>
      <AppShell onLogout={logout}>
        {/* Pages re-render their text in the new language when it changes. */}
        <Routes key={lang}>
          <Route path="/" element={<RoleHome />} />
          <Route
            path="/sets"
            element={
              <Guard permission="asset.registry.view">
                <SetsPage />
              </Guard>
            }
          />
          <Route
            path="/sets/new"
            element={
              <Guard permission="asset.create">
                <AssetCreatePage kind="SET" />
              </Guard>
            }
          />
          <Route
            path="/sets/:id"
            element={
              <Guard permission="asset.detail.view">
                <SetDetailPage />
              </Guard>
            }
          />
          <Route
            path="/tools"
            element={
              <Guard permission="asset.registry.view">
                <ToolsPage />
              </Guard>
            }
          />
          <Route
            path="/tools/new"
            element={
              <Guard permission="asset.create">
                <AssetCreatePage kind="TOOL" />
              </Guard>
            }
          />
          <Route
            path="/tools/:id"
            element={
              <Guard permission="asset.detail.view">
                <ToolDetailPage />
              </Guard>
            }
          />
          <Route
            path="/standalone-tools"
            element={
              <Guard permission="asset.registry.view">
                <StandaloneToolsPage />
              </Guard>
            }
          />
          <Route
            path="/expiry"
            element={
              // A department sees its own Sets and instruments here (to send them before they expire).
              <Guard permission={['asset.registry.view', 'department.workspace']}>
                <SterileExpiryPage />
              </Guard>
            }
          />
          <Route path="/assets" element={<Navigate to="/sets" replace />} />
          <Route
            path="/bin"
            element={
              <Guard permission="asset.delete">
                <BinPage />
              </Guard>
            }
          />
          <Route
            path="/stock"
            element={
              <Guard permission="stock.manage">
                <StockPage />
              </Guard>
            }
          />
          <Route
            path="/sterilization"
            element={
              <Guard permission="sterilization.workspace">
                <SterilizationPage />
              </Guard>
            }
          />
          <Route
            path="/tools/names"
            element={
              <Guard permission="asset.edit">
                <NameCheckPage />
              </Guard>
            }
          />
          <Route path="/replacements" element={<Navigate to="/issues?tab=replacements" replace />} />
          <Route
            path="/import"
            element={
              <Guard permission="asset.create">
                <ImportPage />
              </Guard>
            }
          />
          <Route
            path="/devices"
            element={
              <Guard permission="sterilization.workspace">
                <DevicesPage />
              </Guard>
            }
          />
          <Route
            path="/overview/department"
            element={
              <Guard permission="overview.view">
                <DepartmentPage />
              </Guard>
            }
          />
          <Route
            path="/department"
            element={
              <Guard permission="department.workspace">
                <DepartmentPage />
              </Guard>
            }
          />
          <Route
            path="/department/tools"
            element={
              <Guard permission="department.workspace">
                <DepartmentPage />
              </Guard>
            }
          />
          <Route
            path="/issues"
            element={
              <Guard permission="issue.view">
                <IssuesPage />
              </Guard>
            }
          />
          <Route
            path="/movements"
            element={
              <Guard permission="history.view">
                <MovementsRoute />
              </Guard>
            }
          />
          <Route
            path="/traceability"
            element={
              <Guard permission="traceability.view">
                <TraceabilityPage />
              </Guard>
            }
          />
          <Route
            path="/reports"
            element={
              <Guard permission="reports.view">
                <ReportsPage />
              </Guard>
            }
          />
          <Route
            path="/studio"
            element={
              <Guard permission="studio.manage">
                <StudioPage />
              </Guard>
            }
          />
          <Route
            path="/overview"
            element={
              <Guard permission="overview.view">
                <HospitalOverviewPage />
              </Guard>
            }
          />
          {/* The hospitals list lives in Studio, with each hospital's plan (it used to be two lists). */}
          <Route path="/hospitals" element={<Navigate to="/studio?tab=platform" replace />} />
          <Route
            path="/hospital"
            element={
              <Guard permission="studio.manage">
                <HospitalAdminPage />
              </Guard>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        {/* On top of the screen lock too: "switch user" there signs out through it. */}
        {signOutLayer}
      </AppShell>
    </UnsavedChangesProvider>
  );
}
