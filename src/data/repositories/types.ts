import type {Issue, Movement, SetAsset, Tool} from '../../types/domain';

export type SurgiDataMode = 'DEMO' | 'PRODUCTION';

export type SurgiInitialData = {
  sets: SetAsset[];
  tools: Tool[];
  movements: Movement[];
  issues: Issue[];
};

/**
 * Boundary between the application state and its backing data source.
 * The current web demo is in-memory; a future Supabase/API repository can
 * implement the same contract without pages importing seed data directly.
 */
export interface SurgiRepository {
  readonly mode: SurgiDataMode;
  getInitialData(): SurgiInitialData;
}
