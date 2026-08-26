import type {SurgiDataMode} from '../repositories';
import {demoAdminRepository} from './demoRepository';
import {productionAdminRepository} from './productionRepository';
import type {AdminRepository} from './types';

export type {AdminRepository} from './types';

export const getAdminRepository = (mode: SurgiDataMode): AdminRepository =>
  mode === 'PRODUCTION' ? productionAdminRepository : demoAdminRepository;
