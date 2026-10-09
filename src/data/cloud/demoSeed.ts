import {demoAdminRepository} from '../adminRepositories/demoRepository';
import {demoSurgiRepository} from '../repositories/demoRepository';
import {seedAppRecords, type CloudRecords} from './appRecords';

/**
 * Fills a Demo hospital with the built-in sample hospital. An evaluation Demo (a prospect's) keeps
 * only the libraries of the sample: its people and departments are real accounts and rows, not the
 * sample's made-up ones.
 */
export const seedDemoOrganization = async (
  organizationId: string,
  options: {evaluation?: boolean; onProgress?: (done: number, total: number) => void} = {},
) => {
  const store = demoSurgiRepository.getInitialData();
  const sample = demoAdminRepository.getInitialData();
  const library = options.evaluation
    ? {...sample, organizations: [], users: [], id: 'state'}
    : {...sample, id: 'state'};
  // The library document is written last: its presence marks a completed seed.
  await seedAppRecords(
    organizationId,
    {
      sets: store.sets,
      tools: store.tools,
      movements: store.movements,
      issues: store.issues,
      processLoads: store.processLoads || [],
      receipts: store.receipts || [],
      deliveries: store.deliveries || [],
      purchaseOrders: store.purchaseOrders || [],
      library: [library],
    } as Partial<CloudRecords>,
    options.onProgress,
  );
};
