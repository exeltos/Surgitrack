import type {ReactNode} from 'react';
import {Navigate, Route, Routes, useLocation, useNavigate} from 'react-router-dom';
import {
  ArrowDownToLine,
  ChartColumn,
  ChevronRight,
  Flame,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react';
import IdleLock from '../../components/layout/IdleLock';
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
      <main className="scan-body">
        <nav className="scan-stations" aria-label={tr('Σταθμοί')}>
          {allowed.map(station => (
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
