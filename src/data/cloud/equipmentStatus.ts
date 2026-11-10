import {supabase} from '../../lib/supabase';
import type {EquipmentTest, OutOfService} from '../../core/libraries';

/**
 * What Sterilization staff keep up for each sterilizer and washer: out of service or not, and its tests. It is a table
 * of its own (not the hospital's library, which only administrators write), one row per equipment name.
 */
export type EquipmentStatus = {name: string; outOfService?: OutOfService; tests: EquipmentTest[]};

type Row = {name: string; out_of_service: OutOfService | null; tests: EquipmentTest[] | null};

export async function loadEquipmentStatus(organizationId: string): Promise<EquipmentStatus[]> {
  const {data, error} = await supabase
    .from('equipment_status')
    .select('name,out_of_service,tests')
    .eq('organization_id', organizationId);
  if (error) throw error;
  return ((data || []) as Row[]).map(row => ({
    name: row.name,
    outOfService: row.out_of_service || undefined,
    tests: Array.isArray(row.tests) ? row.tests : [],
  }));
}

/** Saves what changed for one piece of equipment (`outOfService: null` puts it back in service). */
export async function saveEquipmentStatus(
  organizationId: string,
  name: string,
  patch: {outOfService?: OutOfService | null; tests?: EquipmentTest[]},
) {
  const {error} = await supabase.from('equipment_status').upsert(
    {
      organization_id: organizationId,
      name,
      ...(patch.outOfService !== undefined ? {out_of_service: patch.outOfService} : {}),
      ...(patch.tests ? {tests: patch.tests} : {}),
      updated_at: new Date().toISOString(),
    },
    {onConflict: 'organization_id,name'},
  );
  if (error) throw error;
}
