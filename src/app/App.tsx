import {useEffect, useState, type ReactNode} from 'react';
import {Routes, Route, Navigate, useNavigate} from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import AuthIndex from '../modules/auth/AuthIndex';
import SetsPage from '../modules/sets/SetsPage';
import SetDetailPage from '../modules/sets/SetDetailPage';
import ToolsPage from '../modules/tools/ToolsPage';
import ToolDetailPage from '../modules/tools/ToolDetailPage';
import AssetCreatePage from '../components/assets/AssetCreatePage';
import StandaloneToolsPage from '../modules/tools/StandaloneToolsPage';
import StockPage from '../modules/stock/StockPage';
import SterilizationPage from '../modules/sterilization/SterilizationPage';
import DepartmentPage from '../modules/department/DepartmentPage';
import CountPage from '../modules/counts/CountPage';
import IssuesPage from '../modules/issues/IssuesPage';
import MovementsPage from '../modules/movements/MovementsPage';
import TraceabilityPage from '../modules/traceability/TraceabilityPage';
import ReportsPage from '../modules/reports/ReportsPage';
import StudioPage from '../modules/studio/StudioPage';
import {useSurgi} from '../store/SurgiStore';
import {useAppPreferences} from '../core/AppPreferences';
import {roleHomePath, type Permission} from '../core/permissions';
import type {SessionUser, UserRole} from '../store/types';
import {setRuntimeDataMode} from '../config/dataMode';
import {supabase} from '../lib/supabase';

function RoleHome() {
  const {role} = useSurgi();
  return <Navigate to={roleHomePath(role)} replace />;
}
const Guard = ({permission, children}: {permission: Permission; children: ReactNode}) => (
  <ProtectedRoute permission={permission}>{children}</ProtectedRoute>
);

export default function App() {
  const {setRole, currentUser} = useSurgi();
  const {lang} = useAppPreferences();
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [goodbye, setGoodbye] = useState('');
  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      const {data} = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session?.user) {
        setAuthenticated(false);
        setAuthReady(true);
        return;
      }
      const sessionEmail = data.session.user.email?.toLowerCase();
      const profileResult =
        sessionEmail === 'info@exeltos.com'
          ? await supabase.rpc('claim_platform_admin')
          : await supabase
              .from('profiles')
              .select('id,name,email,role,active,organization_id,department_id')
              .eq('id', data.session.user.id)
              .single();
      const profile = profileResult.data;
      if (!mounted) return;
      if (!profile?.active) {
        await supabase.auth.signOut();
        setAuthenticated(false);
        setAuthReady(true);
        return;
      }
      const role = profile.role as UserRole;
      const user: SessionUser = {
        id: profile.id,
        name: profile.name,
        role,
        department: profile.organization_id ? profile.department_id || '' : 'Platform',
      };
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
  if (!authenticated) return <AuthIndex onAuthenticated={login} goodbye={goodbye} />;
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
