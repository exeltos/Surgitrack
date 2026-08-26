import type {SurgiDataMode} from '../data/repositories';

/**
 * Current standalone build uses demo data. Change this single value to
 * PRODUCTION when a real backend repository is wired; production bootstraps clean.
 */
export const SURGITRACK_DATA_MODE: SurgiDataMode = 'DEMO';
