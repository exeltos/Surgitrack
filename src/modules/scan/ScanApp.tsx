import {useState, type ReactNode} from 'react';
import {Navigate, Route, Routes, useLocation, useNavigate} from 'react-router-dom';
import {
  ArrowDownToLine,
  ChartColumn,
  ChevronRight,
  Flame,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react';
import IdleLock from '../../components/layout/IdleLock';
import RoleSwitcher from '../../components/layout/RoleSwitcher';
import {tellUser} from '../../components/ui/confirmService';
import {getRuntimeDataMode, setRuntimeDataMode} from '../../config/dataMode';
import {isPlatformOnly} from '../../core/platformOnly';
import {getRealIdentity} from '../../data/cloud/identity';
import {enterPlatformDemo} from '../../data/cloud/platformDemo';
import {useLibraries} from '../../core/LibraryStore';
import {DEFAULT_IDLE_LOCK_MINUTES} from '../../core/libraryTypes';
import type {Permission} from '../../core/permissions';
import type {SessionUser} from '../../store/types';
import {tr, trData} from '../../i18n';
import {useSurgi} from '../../store/SurgiStore';
import {SCAN_PATH, isScanStandalone} from './scanApp';
import DeliverStation from './stations/DeliverStation';
import LoadStation from './stations/LoadStation';
import LookupStation from './stations/LookupStation';
import ReceiveStation from './stations/ReceiveStation';
import ReleaseStation from './stations/ReleaseStation';
import ReportStation from './stations/ReportStation';
import {useNewVersion} from './useNewVersion';

type Station = {
  path: string;
  title: string;
  text: string;
  icon: ReactNode;
  tone: string;
  permission?: Permission;
  /** Only for these people, whatever the permissions. */
  only?: (user: SessionUser) => boolean;
};

/** The hospital admin and the Sterilization supervisor: the day's report. */
const managesSterilization = (user: SessionUser) =>
  user.role === 'ADMIN' || (user.role === 'STERILIZATION' && !!user.supervisor);

const stations = (): Station[] => [
  {
    path: 'receive',
    title: tr('Παραλαβή'),
    text: tr('Από τα τμήματα στην Αποστείρωση'),
    icon: <ArrowDownToLine size={26} />,
    tone: 'receive',
    permission: 'sterilization.receive',
  },
  {
    path: 'load',
    title: tr('Φόρτωση κλιβάνου'),
    text: tr('Σάρωση όσων μπαίνουν στον κύκλο'),
    icon: <Flame size={26} />,
    tone: 'load',
    permission: 'sterilization.cycle',
  },
  {
    path: 'release',
    title: tr('Αποδέσμευση'),
    text: tr('Τέλος κύκλου, δείκτες, αποδέσμευση φορτίου'),
    icon: <ShieldCheck size={26} />,
    tone: 'release',
    permission: 'sterilization.cycle',
  },
  {
    path: 'deliver',
    title: tr('Παράδοση'),
    text: tr('Αποστειρωμένα προς τμήμα / αίθουσα'),
    icon: <Truck size={26} />,
    tone: 'deliver',
    permission: 'sterilization.deliver',
  },
  {
    path: 'lookup',
    title: tr('Αναζήτηση'),
    text: tr('Σκανάρετε ένα Σετ: πού είναι, τι έγινε'),
    icon: <Search size={26} />,
    tone: 'lookup',
  },
  {
    path: 'report',
    title: tr('Αναφορά'),
    text: tr('Η ημέρα: παραλαβές, φορτία, παραδόσεις, εκκρεμότητες'),
    icon: <ChartColumn size={26} />,
    tone: 'report',
    only: managesSterilization,
  },
];

/**
 * SurgiTrack on the phone: only the scanning stations the signed-in person may use (receipt, sterilizer
 * loading, release, delivery, lookup), full screen and large for one hand. Every scan follows the same
 * rules and lands in the same records as the Sterilization screen of the full app.
 */
export default function ScanApp({onLogout}: {onLogout: (direct?: boolean) => void}) {
  const {currentUser, organizationName, can, toast, clearToast} = useSurgi();
  const {systemSettings} = useLibraries();
  const navigate = useNavigate();
  // A newer version loads on the stations screen, never in the middle of a round.
  useNewVersion(useLocation().pathname === SCAN_PATH);
  const standalone = isScanStandalone();
  const allowed = stations().filter(
    station => (!station.permission || can(station.permission)) && (!station.only || station.only(currentUser)),
  );
  const toStations = () => navigate(SCAN_PATH);
  // The platform owner: outside a hospital there is nothing to scan, so the Demo opens from here; in the
  // Demo, a bar to pick the role and to leave it (as in the full app).
  const [enteringDemo, setEnteringDemo] = useState(false);
  const owner = !!getRealIdentity()?.platform;
  const ownerDemo = owner && getRuntimeDataMode() === 'DEMO';
  const ownerOutside = owner && isPlatformOnly();
  const enterDemo = () => {
    setEnteringDemo(true);
    void enterPlatformDemo('ADMIN').then(error => {
      if (error === undefined) return;
      setEnteringDemo(false);
      void tellUser(tr('Είσοδος Demo'), error || tr('Δεν ήταν δυνατή η είσοδος στο Demo.'));
    });
  };
  const leaveDemo = () => {
    sessionStorage.removeItem('surgitrack-demo-role');
    sessionStorage.removeItem('surgitrack-session-user');
    sessionStorage.removeItem('surgitrack-active-organization');
    setRuntimeDataMode('PRODUCTION');
    window.location.hash = standalone ? `#${SCAN_PATH}` : '#/studio';
    window.location.reload();
  };

  const home = (
    <div className="scan-screen">
      <header className="scan-head">
        <div className="scan-head-row">
          <span>{organizationName ? trData(organizationName) : 'SurgiTrack'}</span>
          {!standalone && (
            <button type="button" className="scan-back" onClick={() => navigate('/')}>
              <LayoutDashboard size={16} /> {tr('Εφαρμογή')}
            </button>
          )}
        </div>
        <h1>{tr('Σάρωση')}</h1>
        <p>
          {trData(currentUser.name)}
          {currentUser.department ? ` · ${trData(currentUser.department)}` : ''}
        </p>
      </header>
      {ownerDemo && (
        <div className="scan-demo-bar" role="status">
          <span className="scan-demo-chip">
            <FlaskConical size={14} /> DEMO
          </span>
          <RoleSwitcher home={SCAN_PATH} />
          <button type="button" onClick={leaveDemo}>
            <LogOut size={15} /> {tr('Έξοδος')}
          </button>
        </div>
      )}
      <main className="scan-body">
        {owner && !ownerDemo && (
          <section className="scan-demo-enter">
            {ownerOutside && (
              <p>{tr('Ο λογαριασμός της πλατφόρμας δεν ανήκει σε νοσοκομείο. Δοκιμάστε τη Σάρωση στο Demo.')}</p>
            )}
            <button type="button" className="scan-primary" disabled={enteringDemo} onClick={enterDemo}>
              <FlaskConical size={18} /> {tr('Είσοδος Demo')}
            </button>
          </section>
        )}
        <nav className="scan-stations" aria-label={tr('Σταθμοί')}>
          {(ownerOutside ? [] : allowed).map(station => (
            <button
              key={station.path}
              type="button"
              className={`scan-station ${station.tone}`}
              onClick={() => navigate(`${SCAN_PATH}/${station.path}`)}
            >
              <span className="scan-station-icon">{station.icon}</span>
              <span>
                <b>{station.title}</b>
                <small>{station.text}</small>
              </span>
              <ChevronRight size={20} />
            </button>
          ))}
        </nav>
        <button type="button" className="scan-signout" onClick={() => onLogout()}>
          <LogOut size={17} /> {tr('Αποσύνδεση')}
        </button>
      </main>
    </div>
  );
  const station = (path: string, element: ReactNode) =>
    allowed.some(item => item.path === path) ? element : <Navigate to={SCAN_PATH} replace />;

  return (
    <div className="scan-app">
      <Routes>
        <Route path={SCAN_PATH} element={home} />
        <Route path={`${SCAN_PATH}/receive`} element={station('receive', <ReceiveStation onStations={toStations} />)} />
        <Route path={`${SCAN_PATH}/load`} element={station('load', <LoadStation onStations={toStations} />)} />
        <Route path={`${SCAN_PATH}/release`} element={station('release', <ReleaseStation onStations={toStations} />)} />
        <Route path={`${SCAN_PATH}/deliver`} element={station('deliver', <DeliverStation onStations={toStations} />)} />
        <Route path={`${SCAN_PATH}/report`} element={station('report', <ReportStation onStations={toStations} />)} />
        <Route path={`${SCAN_PATH}/lookup`} element={station('lookup', <LookupStation onStations={toStations} />)} />
        <Route path="*" element={<Navigate to={SCAN_PATH} replace />} />
      </Routes>
      {toast && (
        <div className={`scan-toast${toast.warning ? ' warning' : ''}`} role="status">
          <span>{toast.text}</span>
          <button type="button" onClick={clearToast} aria-label={tr('Κλείσιμο')}>
            <X size={16} />
          </button>
        </div>
      )}
      <IdleLock
        minutes={systemSettings.idleLockMinutes ?? DEFAULT_IDLE_LOCK_MINUTES}
        userName={currentUser.name}
        hospital={organizationName}
        onSwitchUser={() => onLogout(true)}
      />
    </div>
  );
}
