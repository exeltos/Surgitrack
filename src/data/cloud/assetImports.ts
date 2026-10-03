import {supabase} from '../../lib/supabase';
import type {SetAsset, Tool} from '../../types/domain';
import {seedAppRecords, type CloudRecords} from './appRecords';

/** Studio imports of Sets and instruments: the log, the barcodes a new import must avoid, undo. */

export type AssetImport = {
  id: string;
  fileName: string;
  sets: number;
  tools: number;
  createdAt: string;
  createdByName?: string;
  undoneAt?: string;
  undoneByName?: string;
};

const PAGE = 1000;

/** Every barcode the hospital uses, current and old, upper case. */
export async function loadHospitalBarcodes(organizationId: string) {
  const barcodes = new Set<string>();
  for (const table of ['instruments', 'instrument_sets']) {
    for (let from = 0; ; from += PAGE) {
      const {data, error} = await supabase
        .from(table)
        .select('id,barcode,legacy_barcodes')
        .eq('organization_id', organizationId)
        .order('id')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const row of data as Array<{barcode: string | null; legacy_barcodes: string[] | null}>) {
        if (row.barcode) barcodes.add(row.barcode.toUpperCase());
        for (const old of row.legacy_barcodes || []) barcodes.add(old.toUpperCase());
      }
      if (data.length < PAGE) break;
    }
  }
  return barcodes;
}

export async function listAssetImports(organizationId: string): Promise<AssetImport[]> {
  const {data, error} = await supabase
    .from('asset_imports')
    .select('id,file_name,sets,tools,created_at,created_by_name,undone_at,undone_by_name')
    .eq('organization_id', organizationId)
    .order('created_at', {ascending: false});
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    fileName: row.file_name,
    sets: row.sets,
    tools: row.tools,
    createdAt: row.created_at,
    createdByName: row.created_by_name || undefined,
    undoneAt: row.undone_at || undefined,
    undoneByName: row.undone_by_name || undefined,
  }));
}

/** Logs the import, then writes its Sets and instruments (an interrupted run can simply run again). */
export async function runAssetImport(
  organizationId: string,
  batch: string,
  fileName: string,
  byName: string,
  records: {sets: SetAsset[]; tools: Tool[]},
  onProgress?: (done: number, total: number) => void,
) {
  const {error} = await supabase.from('asset_imports').upsert(
    {
      organization_id: organizationId,
      id: batch,
      file_name: fileName,
      sets: records.sets.length,
      tools: records.tools.length,
      created_by_name: byName,
    },
    {onConflict: 'organization_id,id', ignoreDuplicates: true},
  );
  if (error) throw error;
  await seedAppRecords(organizationId, records as unknown as Partial<CloudRecords>, onProgress);
}

/** How many of the import's records were already used (handed over, sterilized or counted). */
export async function usedImportRecords(organizationId: string, batch: string) {
  const used = (table: string) =>
    supabase
      .from(table)
      .select('id', {count: 'exact', head: true})
      .eq('organization_id', organizationId)
      .eq('extra->>importBatch', batch)
      .or('uses.gt.0,state.not.in.(IN_DEPARTMENT,IN_STOCK)');
  const [tools, sets] = await Promise.all([used('instruments'), used('instrument_sets')]);
  if (tools.error) throw tools.error;
  if (sets.error) throw sets.error;
  return (tools.count || 0) + (sets.count || 0);
}

/** Removes every Set and instrument the import created and marks it undone. */
export async function undoAssetImport(organizationId: string, batch: string, byName: string) {
  for (const table of ['instruments', 'instrument_sets']) {
    const {error} = await supabase
      .from(table)
      .delete()
      .eq('organization_id', organizationId)
      .eq('extra->>importBatch', batch);
    if (error) throw error;
  }
  const {error} = await supabase
    .from('asset_imports')
    .update({undone_at: new Date().toISOString(), undone_by_name: byName})
    .eq('organization_id', organizationId)
    .eq('id', batch);
  if (error) throw error;
}
