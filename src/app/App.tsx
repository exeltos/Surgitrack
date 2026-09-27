import {lazy, Suspense, useEffect, useRef, useState, type ReactNode} from 'react';
import {Routes, Route, Navigate, useLocation, useNavigate} from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import AuthIndex from '../modules/auth/AuthIndex';
import PendingAccess from '../modules/auth/PendingAccess';
import {useSurgi} from '../store/SurgiStore';
import {useAppPreferences} from '../core/AppPreferences';
import {roleHomePath, type Permission} from '../core/permissions';
import type {SessionUser} from '../store/types';
import {getRuntimeDataMode, setRuntimeDataMode} from '../config/dataMode';
import {supabase} from '../lib/supabase';
import {
  type AccessRequest,
  canViewAs,
  clearIdentity,
  productionOrganizationFor,
  resolveIdentity,
  sessionUserFor,
} from '../data/cloud/identity';

// Route pages are code-split so the sign-in screen and each workspace load only what they need.
const SetsPage = lazy(() => import('../modules/sets/SetsPage'));
const SetDetailPage = lazy(() => import('../modules/sets/SetDetailPage'));
const ToolsPage = lazy(() => import('../modules/tools/ToolsPage'));
const ToolDetailPage = lazy(() => import('../modules/tools/ToolDetailPage'));
const AssetCreatePage = lazy(() => import('../components/assets/AssetCreatePage'));
const StandaloneToolsPage = lazy(() => import('../modules/tools/StandaloneToolsPage'));
const StockPage = lazy(() => import('../modules/stock/StockPage'));
const SterilizationPage = lazy(() => import('../modules/sterilization/SterilizationPage'));
const DepartmentPage = lazy(() => import('../modules/department/DepartmentPage'));
const CountPage = lazy(() => import('../modules/counts/CountPage'));
const IssuesPage = lazy(() => import('../modules/issues/IssuesPage'));
const MovementsPage = lazy(() => import('../modules/movements/MovementsPage'));
const TraceabilityPage = lazy(() => import('../modules/traceability/TraceabilityPage'));
const ReportsPage = lazy(() => import('../modules/reports/ReportsPage'));
const StudioPage = lazy(() => import('../modules/studio/StudioPage'));
const HospitalAdminPage = lazy(() => import('../modules/hospital/HospitalAdminPage'));
const JoinPage = lazy(() => import('../modules/auth/JoinPage'));

const readDemoSessionUser = (): SessionUser | undefined => {
  try {
    const user = JSON.parse(sessionStorage.getItem('surgitrack-session-user') || 'null') as SessionUser | null;
    return user?.id && user.role && user.role === sessionStorage.getItem('surgitrack-demo-role') ? user : undefined;
  } catch {
    return undefined;
  }
};

function RoleHome() {
  const {role} = useSurgi();
  return <Navigate to={roleHomePath(role)} replace />;
}
const Guard = ({permission, children}: {permission: Permission; children: ReactNode}) => (
  <ProtectedRoute permission={permission}>
    <Suspense fallback={null}>{children}</Suspense>
  </ProtectedRoute>
);

export default function App() {
  const {setRole, currentUser} = useSurgi();
  const {lang} = useAppPreferences();
  const navigate = useNavigate();
  const location = useLocation();
  const [authenticated, setAuthenticated] = useState(false);
  const [accessRequest, setAccessRequest] = useState<AccessRequest>();
  const [authReady, setAuthReady] = useState(false);
  const [goodbye, setGoodbye] = useState('');
  const [passwordRecovery, setPasswordRecovery] = useState(() => /type=(recovery|invite)/.test(window.location.hash));
  const recoveryRef = useRef(passwordRecovery);
  useEffect(() => {
    recoveryRef.current = passwordRecovery;
  }, [passwordRecovery]);
  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      if (recoveryRef.current || /type=(recovery|invite)/.test(window.location.hash)) {
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
      setRole(role);
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
  }, [setRole]);
  // After sign-in the page reloads so the workspace gate can load the user's hospital.
  const login = () => {
    sessionStorage.setItem('surgitrack-auth', '1');
    sessionStorage.removeItem('surgitrack-session-user');
    sessionStorage.removeItem('surgitrack-view-as');
    window.location.hash = '#/';
    window.location.reload();
  };
  const logout = async () => {
    const msg =
      lang === 'el'
        ? `Καλή συνέχεια, ${currentUser.name.split(' ')[0]}.`
        : `See you soon, ${currentUser.name.split(' ')[0]}.`;
    if (!window.confirm(lang === 'el' ? 'Θέλετε να αποσυνδεθείτε από το SurgiTrack;' : 'Sign out of SurgiTrack?'))
      return;
    const wasDemo = sessionStorage.getItem('surgitrack-data-mode') === 'DEMO';
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
    navigate('/', {replace: true});
  };
  // A hospital's signup link is public: it works signed in or not.
  const joinToken = /^\/join\/([0-9a-f]{16,})$/.exec(location.pathname)?.[1];
  if (joinToken)
    return (
      <Suspense fallback={null}>
        <JoinPage token={joinToken} />
      </Suspense>
    );
  if (!authReady) return null;
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
        onAuthenticated={login}
        goodbye={goodbye}
        passwordRecovery={passwordRecovery}
        onPasswordRecoveryHandled={() => setPasswordRecovery(false)}
      />
    );
  return (
    <AppShell onLogout={logout}>
      <Routes>
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
        <Route path="/assets" element={<Navigate to="/sets" replace />} />
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
          path="/department"
          element={
            <Guard permission="department.workspace">
              <DepartmentPage />
            </Guard>
          }
        />
        <Route
          path="/counts"
          element={
            <Guard permission="counts.record">
              <CountPage />
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
              <MovementsPage />
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
          path="/hospital"
          element={
            <Guard permission="studio.manage">
              <HospitalAdminPage />
            </Guard>
          }
        />
        <Route path="*" element={<RoleHome />} />
      </Routes>
    </AppShell>
  );
}
