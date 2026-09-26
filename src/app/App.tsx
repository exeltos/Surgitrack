import {lazy, Suspense, useEffect, useRef, useState, type ReactNode} from 'react';
import {Routes, Route, Navigate, useNavigate} from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import AuthIndex from '../modules/auth/AuthIndex';
import {useSurgi} from '../store/SurgiStore';
import {useAppPreferences} from '../core/AppPreferences';
import {roleHomePath, type Permission} from '../core/permissions';
import type {SessionUser, UserRole} from '../store/types';
import {setRuntimeDataMode} from '../config/dataMode';
import {supabase} from '../lib/supabase';

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
  const [authenticated, setAuthenticated] = useState(false);
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
      const {data} = await supabase.auth.getSession();
      if (!mounted) return;
      if (recoveryRef.current || /type=(recovery|invite)/.test(window.location.hash)) {
        setPasswordRecovery(true);
        setAuthenticated(false);
        setAuthReady(true);
        return;
      }
      if (!data.session?.user) {
        setAuthenticated(false);
        setAuthReady(true);
        return;
      }
      const sessionEmail = data.session.user.email?.toLowerCase();
      let role: UserRole;
      let user: SessionUser;
      if (sessionEmail === 'info@exeltos.com') {
        const {error: claimError} = await supabase.rpc('claim_platform_admin');
        if (claimError) {
          setAuthenticated(false);
          setAuthReady(true);
          return;
        }
        role = 'ADMIN';
        user = {
          id: data.session.user.id,
          name: 'Platform Admin',
          role: 'ADMIN',
          department: 'Platform',
        };
      } else {
        const {data: profile} = await supabase
          .from('profiles')
          .select('id,name,email,role,active,organization_id,department_id')
          .eq('id', data.session.user.id)
          .single();
        if (!mounted) return;
        if (!profile?.active) {
          await supabase.auth.signOut();
          setAuthenticated(false);
          setAuthReady(true);
          return;
        }
        role = profile.role as UserRole;
        user = {
          id: profile.id,
          name: profile.name,
          role,
          department: profile.organization_id ? profile.department_id || '' : 'Platform',
        };
      }
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
  const login = (role: UserRole = 'STERILIZATION', user?: SessionUser) => {
    sessionStorage.setItem('surgitrack-auth', '1');
    sessionStorage.setItem('surgitrack-demo-role', role);
    if (user) sessionStorage.setItem('surgitrack-session-user', JSON.stringify(user));
    else sessionStorage.removeItem('surgitrack-session-user');
    setRole(role);
    setAuthenticated(true);
    setGoodbye('');
    navigate(roleHomePath(role), {replace: true});
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
  if (!authReady) return null;
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
        <Route path="*" element={<RoleHome />} />
      </Routes>
    </AppShell>
  );
}
