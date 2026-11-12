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
  // The open stage stands out; a stage with nothing in it fades (it stays clickable).
  const step = (id: string, count: number) => [queue === id ? 'active' : '', count ? '' : 'empty'].join(' ').trim();
  // On a phone the stages scroll sideways: the open one is kept in view.
  useEffect(() => {
    const active = strip.current?.querySelector<HTMLElement>('button.active');
    const box = strip.current;
    if (!active || !box || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo?.({left: active.offsetLeft - box.offsetLeft - 8, behavior: 'smooth'});
  }, [queue]);
  return (
    <div className="sterile-queues modern workflow-configured-queues ster-steps" ref={strip}>
      {/* One stage after the other, each an arrow pointing to the next (the flow). */}
      {[
        <button
          key="INCOMING"
          className={step('INCOMING', incoming.length)}
          data-tour="queue-INCOMING"
          onClick={() => setQueue('INCOMING')}
        >
          <Send />
          <span>{tr('Παραλαβή')}</span>
          <strong>{incoming.length}</strong>
        </button>,
        (stageEnabled('WASHING') || washing.length > 0) && (
          <button
            key="WASHING"
            className={step('WASHING', washing.length)}
            data-tour="queue-WASHING"
            onClick={() => setQueue('WASHING')}
          >
            <PackageOpen />
            <span>{trc('stage', 'Καθαρισμός')}</span>
            <strong>{washing.length}</strong>
          </button>
        ),
        (stageEnabled('PREPARATION') || preparation.length > 0) && (
          <button
            key="PREP"
            className={step('PREP', preparation.length)}
            data-tour="queue-PREP"
            onClick={() => setQueue('PREP')}
          >
            <Layers3 />
            <span>{tr('Σύνθεση')}</span>
            <strong>{preparation.length}</strong>
          </button>
        ),
        (stageEnabled('PACKAGING') || packaging.length > 0) && (
          <button
            key="PACKAGING"
            className={step('PACKAGING', packaging.length)}
            data-tour="queue-PACKAGING"
            onClick={() => setQueue('PACKAGING')}
          >
            <Box />
            <span>{tr('Συσκευασία')}</span>
            <strong>{packaging.length}</strong>
          </button>
        ),
        <button
          key="PROCESS"
          className={step('PROCESS', processing.length)}
          data-tour="queue-PROCESS"
          onClick={() => setQueue('PROCESS')}
        >
          <Flame />
          <span>{tr('Φόρτωση')}</span>
          <strong>{processing.length}</strong>
        </button>,
        <button
          key="IN_STERILIZER"
          className={step('IN_STERILIZER', inSterilizer.length)}
          data-tour="queue-IN_STERILIZER"
          onClick={() => setQueue('IN_STERILIZER')}
        >
          <Hourglass />
          <span>{tr('Στον κλίβανο')}</span>
          <strong>{inSterilizer.length}</strong>
        </button>,
        (stageEnabled('RELEASE') || awaitingRelease.length > 0 || inSterilizer.length > 0) && (
          <button
            key="RELEASE"
            className={step('RELEASE', awaitingRelease.length)}
            data-tour="queue-RELEASE"
            onClick={() => setQueue('RELEASE')}
          >
            <ShieldCheck />
            <span>{tr('Αποδέσμευση')}</span>
            <strong>{awaitingRelease.length}</strong>
          </button>
        ),
        (stageEnabled('STORAGE') || storage.length > 0) && (
          <button
            key="STORAGE"
            className={step('STORAGE', storage.length)}
            data-tour="queue-STORAGE"
            onClick={() => setQueue('STORAGE')}
          >
            <PackageCheck />
            <span>{tr('Αποθήκευση')}</span>
            <strong>{storage.length}</strong>
          </button>
        ),
        <button
          key="READY"
          className={step('READY', ready.length)}
          data-tour="queue-READY"
          onClick={() => setQueue('READY')}
        >
          <UserRoundCheck />
          <span>{tr('Παράδοση')}</span>
          <strong>{ready.length}</strong>
        </button>,
      ].filter(Boolean)}
    </div>
  );
}
