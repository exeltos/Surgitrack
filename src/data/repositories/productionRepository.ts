import type {SurgiRepository} from './types';

/** A hospital starts empty: its records come from the cloud workspace (src/data/cloud). */
export const productionSurgiRepository: SurgiRepository = {
  mode: 'PRODUCTION',
  getInitialData: () => ({sets: [], tools: [], movements: [], issues: []}),
};
