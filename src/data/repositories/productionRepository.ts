import type {SurgiRepository} from './types';

/**
 * Clean production bootstrap. A real backend adapter will replace this
 * implementation when SurgiTrack is connected to Supabase/API storage.
 */
export const productionSurgiRepository: SurgiRepository = {
  mode: 'PRODUCTION',
  getInitialData: () => ({sets: [], tools: [], movements: [], issues: []}),
};
