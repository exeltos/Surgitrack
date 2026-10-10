import {demoAdminRepository} from '../adminRepositories/demoRepository';
import {demoSurgiRepository} from '../repositories/demoRepository';
import {seedAppRecords, type CloudRecords} from './appRecords';
import {demoShiftDays} from '../demoDates';

/**
 * The sample hospital's version, kept with every load of an evaluation Demo. 2: dates moved to
 * today; composition, release and count records included.
 */
export const DEMO_PACK_VERSION = 2;

/**
 * Fills a Demo hospital with the built-in sample hospital. An evaluation Demo (a prospect's) keeps
 * only the libraries of the sample: its people and departments are real accounts and rows, not the
 * sample's made-up ones.
 */
export const seedDemoOrganization = async (
  organizationId: string,
  options: {evaluation?: boolean; onProgress?: (done: number, total: number) => void; screenGuides?: boolean} = {},
): Promise<{records: number; shiftedDays: number}> => {
  const store = demoSurgiRepository.getInitialData();
  const sample = demoAdminRepository.getInitialData();
  const base = options.evaluation ? {...sample, organizations: [], users: [], id: 'state'} : {...sample, id: 'state'};
  // The on-screen guides, when the Demo was opened with them chosen on or off.
  const library =
    options.screenGuides === undefined
      ? base
      : {...base, systemSettings: {...base.systemSettings, screenGuides: options.screenGuides}};
  // The library document is written last: its presence marks a completed seed.
  const records = {
    sets: store.sets,
    tools: store.tools,
    movements: store.movements,
    issues: store.issues,
    processLoads: store.processLoads || [],
    receipts: store.receipts || [],
    deliveries: store.deliveries || [],
    purchaseOrders: store.purchaseOrders || [],
    // Who composed and released the sterile Sets, and the counts in theatre.
    preparations: store.preparations || [],
    sterilizationReleases: store.sterilizationReleases || [],
    counts: store.counts || [],
    library: [library],
  } as Partial<CloudRecords>;
  await seedAppRecords(organizationId, records, options.onProgress);
  return {
    records: Object.values(records).reduce((sum, items) => sum + (items?.length || 0), 0),
    shiftedDays: demoShiftDays(),
  };
};
