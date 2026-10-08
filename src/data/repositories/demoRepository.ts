import {
  counts,
  deliveries,
  issues,
  movements,
  preparations,
  processLoads,
  purchaseOrders,
  receipts,
  sets,
  sterilizationReleases,
  tools,
} from '../demo';
import type {SurgiInitialData, SurgiRepository} from './types';

const cloneInitialData = (): SurgiInitialData => ({
  sets: sets.map(item => ({
    ...item,
    compositionTemplate: item.compositionTemplate?.map(line => ({...line})),
    legacyBarcodes: item.legacyBarcodes ? [...item.legacyBarcodes] : undefined,
    photos: item.photos ? item.photos.map(photo => ({...photo})) : undefined,
  })),
  tools: tools.map(item => ({
    ...item,
    legacyBarcodes: item.legacyBarcodes ? [...item.legacyBarcodes] : undefined,
    photos: item.photos ? item.photos.map(photo => ({...photo})) : undefined,
  })),
  movements: movements.map(item => ({...item})),
  issues: issues.map(item => ({...item, photos: item.photos ? item.photos.map(photo => ({...photo})) : undefined})),
  processLoads: processLoads.map(load => ({...load, items: load.items.map(item => ({...item}))})),
  receipts: receipts.map(item => ({...item})),
  deliveries: deliveries.map(item => ({...item})),
  purchaseOrders: purchaseOrders.map(order => ({...order, lines: order.lines.map(line => ({...line}))})),
  preparations: preparations.map(item => ({
    ...item,
    toolIds: [...item.toolIds],
    checkedToolIds: [...item.checkedToolIds],
  })),
  sterilizationReleases: sterilizationReleases.map(item => ({...item})),
  counts: counts.map(count => ({
    ...count,
    checkedToolIds: [...(count.checkedToolIds || [])],
    missing: [...(count.missing || [])],
  })),
});

export const demoSurgiRepository: SurgiRepository = {
  mode: 'DEMO',
  getInitialData: cloneInitialData,
};
