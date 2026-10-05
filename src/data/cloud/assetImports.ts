import {namesByCode} from '../../core/nameCheck';
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
/**
 * What an import is checked against: every barcode in use in the hospital (old ones too), and the
 * name the hospital already gives each instrument code.
 */
export async function loadHospitalAssets(organizationId: string) {
  const barcodes = new Set<string>();
  const instruments: Array<{id: string; code: string; name: string}> = [];
  for (const table of ['instruments', 'instrument_sets']) {
    for (let from = 0; ; from += PAGE) {
      const {data, error} = await supabase
        .from(table)
        .select(table === 'instruments' ? 'id,barcode,legacy_barcodes,code,name' : 'id,barcode,legacy_barcodes')
        .eq('organization_id', organizationId)
        .order('id')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = data as unknown as Array<{
        id: string;
        barcode: string | null;
        legacy_barcodes: string[] | null;
        code?: string | null;
        name?: string | null;
      }>;
      for (const row of rows) {
        if (row.barcode) barcodes.add(row.barcode.toUpperCase());
        for (const old of row.legacy_barcodes || []) barcodes.add(old.toUpperCase());
        if (table === 'instruments' && row.code && row.name)
          instruments.push({id: row.id, code: row.code, name: row.name});
      }
      if (rows.length < PAGE) break;
    }
  }
  return {barcodes, names: namesByCode(instruments)};
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

/**
 * Removes every Set and instrument the import created and marks it undone, in one database
 * transaction that refuses when any of them was used. Returns how many were in use (0 = undone).
 */
export async function undoAssetImport(organizationId: string, batch: string, byName: string) {
  const {error} = await supabase.rpc('platform_undo_asset_import', {
    p_org: organizationId,
    p_batch: batch,
    p_by: byName,
  });
  const inUse = error?.message.match(/import_in_use:(\d+)/);
  if (inUse) return Number(inUse[1]);
  if (error) throw error;
  return 0;
}
