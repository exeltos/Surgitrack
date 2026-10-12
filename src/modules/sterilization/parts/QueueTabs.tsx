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
import {useEffect, useRef} from 'react';
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
  const strip = useRef<HTMLDivElement>(null);
  // On a phone the stages scroll sideways: the open one is kept in view.
  useEffect(() => {
    const active = strip.current?.querySelector<HTMLElement>('button.active');
    const box = strip.current;
    if (!active || !box || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo?.({left: active.offsetLeft - box.offsetLeft - 8, behavior: 'smooth'});
  }, [queue]);
  return (
    <div className="sterile-queues modern workflow-configured-queues" ref={strip}>
      <button
        className={queue === 'INCOMING' ? 'active' : ''}
        data-tour="queue-INCOMING"
        onClick={() => setQueue('INCOMING')}
      >
        <Send />
        <span>{tr('Παραλαβή')}</span>
        <strong>{incoming.length}</strong>
        <small>{tr('Αλυσίδα φύλαξης')}</small>
      </button>
      {(stageEnabled('WASHING') || washing.length > 0) && (
        <button
          className={queue === 'WASHING' ? 'active' : ''}
          data-tour="queue-WASHING"
          onClick={() => setQueue('WASHING')}
        >
          <PackageOpen />
          <span>{trc('stage', 'Καθαρισμός')}</span>
          <strong>{washing.length}</strong>
          <small>{tr('Πλύση & απολύμανση')}</small>
        </button>
      )}
      {(stageEnabled('PREPARATION') || preparation.length > 0) && (
        <button className={queue === 'PREP' ? 'active' : ''} data-tour="queue-PREP" onClick={() => setQueue('PREP')}>
          <Layers3 />
          <span>{tr('Σύνθεση')}</span>
          <strong>{preparation.length}</strong>
          <small>{tr('Έλεγχος εργαλείων')}</small>
        </button>
      )}
      {(stageEnabled('PACKAGING') || packaging.length > 0) && (
        <button
          className={queue === 'PACKAGING' ? 'active' : ''}
          data-tour="queue-PACKAGING"
          onClick={() => setQueue('PACKAGING')}
        >
          <Box />
          <span>{tr('Συσκευασία')}</span>
          <strong>{packaging.length}</strong>
          <small>{tr('Συσκευασία & σήμανση')}</small>
        </button>
      )}
      <button
        className={queue === 'PROCESS' ? 'active' : ''}
        data-tour="queue-PROCESS"
        onClick={() => setQueue('PROCESS')}
      >
        <Flame />
        <span>{tr('Φόρτωση')}</span>
        <strong>{processing.length}</strong>
        <small>{tr('Κλίβανος & φορτίο')}</small>
      </button>
      <button
        className={queue === 'IN_STERILIZER' ? 'active' : ''}
        data-tour="queue-IN_STERILIZER"
        onClick={() => setQueue('IN_STERILIZER')}
      >
        <Hourglass />
        <span>{tr('Στον κλίβανο')}</span>
        <strong>{inSterilizer.length}</strong>
        <small>{tr('Κύκλος σε εξέλιξη')}</small>
      </button>
      {(stageEnabled('RELEASE') || awaitingRelease.length > 0 || inSterilizer.length > 0) && (
        <button
          className={queue === 'RELEASE' ? 'active' : ''}
          data-tour="queue-RELEASE"
          onClick={() => setQueue('RELEASE')}
        >
          <ShieldCheck />
          <span>{tr('Αποδέσμευση')}</span>
          <strong>{awaitingRelease.length}</strong>
          <small>{tr('Πύλη ποιότητας')}</small>
        </button>
      )}
      {(stageEnabled('STORAGE') || storage.length > 0) && (
        <button
          className={queue === 'STORAGE' ? 'active' : ''}
          data-tour="queue-STORAGE"
          onClick={() => setQueue('STORAGE')}
        >
          <PackageCheck />
          <span>{tr('Αποθήκευση')}</span>
          <strong>{storage.length}</strong>
          <small>{tr('Πριν την παράδοση')}</small>
        </button>
      )}
      <button className={queue === 'READY' ? 'active' : ''} data-tour="queue-READY" onClick={() => setQueue('READY')}>
        <UserRoundCheck />
        <span>{tr('Παράδοση')}</span>
        <strong>{ready.length}</strong>
        <small>{tr('Προς τμήμα')}</small>
      </button>
    </div>
  );
}
