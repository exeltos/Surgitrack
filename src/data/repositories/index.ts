import {productionSurgiRepository} from './productionRepository';
import type {SurgiDataMode, SurgiRepository} from './types';

export type {SurgiDataMode, SurgiInitialData, SurgiRepository} from './types';

// The sample hospital ships in its own file, downloaded only in Demo mode (main.tsx loads it before
// the first render), so a real hospital's users never download it.
let demoSurgiRepository: SurgiRepository | undefined;
export const loadDemoRepository = async () => {
  demoSurgiRepository ??= (await import('./demoRepository')).demoSurgiRepository;
};

export const getSurgiRepository = (mode: SurgiDataMode): SurgiRepository => {
  if (mode === 'PRODUCTION') return productionSurgiRepository;
  if (!demoSurgiRepository) throw new Error('SurgiTrack: the Demo data were not loaded (loadDemoRepository).');
  return demoSurgiRepository;
};
