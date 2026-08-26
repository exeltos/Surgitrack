import type {LibraryState} from '../../core/libraryTypes';
import type {SurgiDataMode} from '../repositories';

export interface AdminRepository {
  readonly mode: SurgiDataMode;
  readonly storageKey: string;
  readonly legacyStorageKeys?: readonly string[];
  getInitialData(): LibraryState;
}
