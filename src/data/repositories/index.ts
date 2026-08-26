import {demoSurgiRepository} from './demoRepository';
import {productionSurgiRepository} from './productionRepository';
import type {SurgiDataMode, SurgiRepository} from './types';

export type {SurgiDataMode, SurgiInitialData, SurgiRepository} from './types';

export const getSurgiRepository = (mode: SurgiDataMode): SurgiRepository =>
  mode === 'PRODUCTION' ? productionSurgiRepository : demoSurgiRepository;
