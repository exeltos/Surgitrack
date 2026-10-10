import {
  PackageCheck,
  Flame,
  Send,
  Box,
  UserRoundCheck,
  ShieldCheck,
  Layers3,
  PackageOpen,
  Hourglass,
} from 'lucide-react';
import {tr, trc} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function QueueTabs({s}: {s: SterilizationPageState}) {
  const {
    awaitingRelease,
    inSterilizer,
    incoming,
    packaging,
    preparation,
    processing,
    queue,
    ready,
    setQueue,
    stageEnabled,
    storage,
    washing,
  } = s;
  return (
    <div className="sterile-queues modern workflow-configured-queues">
      <button className={queue === 'INCOMING' ? 'active' : ''} onClick={() => setQueue('INCOMING')}>
        <Send />
        <span>{tr('Παραλαβή')}</span>
        <strong>{incoming.length}</strong>
        <small>{tr('Αλυσίδα φύλαξης')}</small>
      </button>
      {(stageEnabled('WASHING') || washing.length > 0) && (
        <button className={queue === 'WASHING' ? 'active' : ''} onClick={() => setQueue('WASHING')}>
          <PackageOpen />
          <span>{trc('stage', 'Καθαρισμός')}</span>
          <strong>{washing.length}</strong>
          <small>{tr('Πλύση / απολύμανση')}</small>
        </button>
      )}
      {(stageEnabled('PREPARATION') || preparation.length > 0) && (
        <button className={queue === 'PREP' ? 'active' : ''} onClick={() => setQueue('PREP')}>
          <Layers3 />
          <span title={tr('Έλεγχος & Σύνθεση')}>{tr('Σύνθεση')}</span>
          <strong>{preparation.length}</strong>
          <small>{tr('Εργαλεία / αποκλίσεις')}</small>
        </button>
      )}
      {(stageEnabled('PACKAGING') || packaging.length > 0) && (
        <button className={queue === 'PACKAGING' ? 'active' : ''} onClick={() => setQueue('PACKAGING')}>
          <Box />
          <span>{tr('Συσκευασία')}</span>
          <strong>{packaging.length}</strong>
          <small>{tr('Συσκευασία / σήμανση')}</small>
        </button>
      )}
      <button className={queue === 'PROCESS' ? 'active' : ''} onClick={() => setQueue('PROCESS')}>
        <Flame />
        <span title={tr('Φόρτωση κλιβάνου')}>{tr('Φόρτωση')}</span>
        <strong>{processing.length}</strong>
        <small>{tr('Κλίβανος / φορτίο')}</small>
      </button>
      <button className={queue === 'IN_STERILIZER' ? 'active' : ''} onClick={() => setQueue('IN_STERILIZER')}>
        <Hourglass />
        <span>{tr('Στον κλίβανο')}</span>
        <strong>{inSterilizer.length}</strong>
        <small>{tr('Κύκλος σε εξέλιξη')}</small>
      </button>
      {(stageEnabled('RELEASE') || awaitingRelease.length > 0) && (
        <button className={queue === 'RELEASE' ? 'active' : ''} onClick={() => setQueue('RELEASE')}>
          <ShieldCheck />
          <span>{tr('Αποδέσμευση')}</span>
          <strong>{awaitingRelease.length}</strong>
          <small>{tr('Πύλη ποιότητας')}</small>
        </button>
      )}
      {(stageEnabled('STORAGE') || storage.length > 0) && (
        <button className={queue === 'STORAGE' ? 'active' : ''} onClick={() => setQueue('STORAGE')}>
          <PackageCheck />
          <span>{tr('Αποθήκευση')}</span>
          <strong>{storage.length}</strong>
          <small>{tr('Πριν την παράδοση')}</small>
        </button>
      )}
      <button className={queue === 'READY' ? 'active' : ''} onClick={() => setQueue('READY')}>
        <UserRoundCheck />
        <span>{tr('Παράδοση')}</span>
        <strong>{ready.length}</strong>
        <small>{tr('Προς τμήμα')}</small>
      </button>
    </div>
  );
}
