import type {SetAsset, Tool} from '../../types/domain';

export type Scanned = {kind: 'SET'; asset: SetAsset} | {kind: 'TOOL'; asset: Tool};

const matches = (barcode: string, item: {barcode: string; legacyBarcodes?: string[]}) =>
  item.barcode.toUpperCase() === barcode || !!item.legacyBarcodes?.some(code => code.toUpperCase() === barcode);

/** The Set or instrument a scanned barcode names, its reissued (legacy) barcodes included. */
export function findScanned(barcode: string, sets: SetAsset[], tools: Tool[]): Scanned | undefined {
  const code = barcode.trim().toUpperCase();
  const set = sets.find(item => matches(code, item));
  if (set) return {kind: 'SET', asset: set};
  const tool = tools.find(item => matches(code, item));
  return tool ? {kind: 'TOOL', asset: tool} : undefined;
}

/** The department a Set or instrument belongs to (an instrument in a Set: the Set's). */
export function departmentOf(found: Scanned, sets: SetAsset[]) {
  if (found.kind === 'SET') return found.asset.department;
  return found.asset.department || sets.find(item => item.id === found.asset.setId)?.department;
}
