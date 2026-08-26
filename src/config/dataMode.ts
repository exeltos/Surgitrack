import type {SurgiDataMode} from '../data/repositories';

/**
 * Normal application sessions start clean. Demo data are loaded only after an
 * administrator explicitly enters Demo from SurgiTrack Studio.
 */
export const SURGITRACK_DATA_MODE: SurgiDataMode = 'PRODUCTION';

export const getRuntimeDataMode = (): SurgiDataMode =>
  sessionStorage.getItem('surgitrack-data-mode') === 'DEMO' ? 'DEMO' : SURGITRACK_DATA_MODE;

export const setRuntimeDataMode = (mode: SurgiDataMode) => {
  if (mode === 'DEMO') sessionStorage.setItem('surgitrack-data-mode', 'DEMO');
  else sessionStorage.removeItem('surgitrack-data-mode');
};
