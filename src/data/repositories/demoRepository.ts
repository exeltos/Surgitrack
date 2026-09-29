import {deliveries, issues, movements, processLoads, receipts, sets, tools} from '../demo';
import type {SurgiInitialData, SurgiRepository} from './types';

const cloneInitialData = (): SurgiInitialData => ({
  sets: sets.map(item => ({
    ...item,
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
});

export const demoSurgiRepository: SurgiRepository = {
  mode: 'DEMO',
  getInitialData: cloneInitialData,
};
