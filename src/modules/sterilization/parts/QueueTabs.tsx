import {PackageCheck, Flame, Send, Box, UserRoundCheck, ShieldCheck, Layers3, PackageOpen} from 'lucide-react';
import {tr, trc} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function QueueTabs({s}: {s: SterilizationPageState}) {
  const {
    awaitingRelease,
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
          <span>{tr('Έλεγχος & Σύνθεση')}</span>
          <strong>{preparation.length}</strong>
          <small>{tr('Εργαλεία / αποκλίσεις')}</small>
        </button>
      )}
      {(stageEnabled('PACKAGING') || packaging.length > 0) && (
        <button className={queue === 'PACKAGING' ? 'active' : ''} onClick={() => setQueue('PACKAGING')}>
          <Box />
          <span>{tr('Συσκευασία')}</span>
          <strong>{packaging.length}</strong>
          <small>{tr('Barrier / σήμανση')}</small>
        </button>
      )}
      <button className={queue === 'PROCESS' ? 'active' : ''} onClick={() => setQueue('PROCESS')}>
        <Flame />
        <span>{tr('Αποστείρωση')}</span>
        <strong>{processing.length}</strong>
        <small>{tr('Κύκλος / φορτίο')}</small>
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
