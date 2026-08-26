import {useState, type ReactNode} from 'react';
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
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem('surgitrack-auth') === '1');
  const [goodbye, setGoodbye] = useState('');
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
  const logout = () => {
    const msg =
      lang === 'el'
        ? `Καλή συνέχεια, ${currentUser.name.split(' ')[0]}.`
        : `See you soon, ${currentUser.name.split(' ')[0]}.`;
    if (!window.confirm(lang === 'el' ? 'Θέλετε να αποσυνδεθείτε από το SurgiTrack;' : 'Sign out of SurgiTrack?'))
      return;
    sessionStorage.removeItem('surgitrack-auth');
    sessionStorage.removeItem('surgitrack-demo-role');
    sessionStorage.removeItem('surgitrack-session-user');
    setGoodbye(msg);
    setAuthenticated(false);
    navigate('/', {replace: true});
  };
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
