import {useEffect, useRef} from 'react';
import {useLibraries} from '../../core/LibraryStore';
import {useSurgi} from '../../store/SurgiStore';
import {testsFromDevices} from '../../core/equipmentTests';
import {useHasModule} from '../../data/cloud/modulesContext';
import {listDevices, listReadings} from '../../data/cloud/devices';

const EVERY_MS = 2 * 60_000;

/**
 * Brings in the results the hospital's test devices (a 3M Bowie-Dick tester, a spore reader…) sent, as tests of the
 * sterilizer each one tests. It runs while a screen that shows the tests is open (the Loading and Release stages, the
 * equipment page): when it opens, every two minutes, and when the window is looked at again. Only people who may
 * record tests do it, and nothing is read in a hospital without connected devices.
 */
export function useTestDeviceSync() {
  const {organizationId, can} = useSurgi();
  const withDevices = useHasModule('DEVICES');
  const {sterilizers, updateEquipment} = useLibraries();
  const allowed = !!organizationId && withDevices && can('sterilization.workspace');
  // The latest library and saver, read without restarting the timer each time they change.
  const latest = useRef({sterilizers, updateEquipment});
  latest.current = {sterilizers, updateEquipment};
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    if (!allowed || !organizationId) return;
    let live = true;
    const run = async () => {
      try {
        const devices = await listDevices(organizationId);
        if (!live || !devices.some(device => device.kind === 'TEST')) return;
        const readings = await listReadings(organizationId, {limit: 500});
        if (!live) return;
        for (const item of latest.current.sterilizers) {
          const found = testsFromDevices(item, devices, readings, attempted.current);
          if (!found) continue;
          found.ids.forEach(id => attempted.current.add(id));
          await latest.current.updateEquipment('sterilizers', item.id, {tests: found.tests}).catch(() => {
            // Tried again the next time.
            found.ids.forEach(id => attempted.current.delete(id));
          });
        }
      } catch {
        // Without the devices tables (an older database) there is nothing to bring in.
      }
    };
    void run();
    const timer = window.setInterval(() => void run(), EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && void run();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [allowed, organizationId]);
}
