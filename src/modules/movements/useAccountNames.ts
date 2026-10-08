import {useEffect, useState} from 'react';
import {supabase} from '../../lib/supabase';

/**
 * Names of the hospital's accounts by id, for the account the database recorded on each history entry.
 * Only in the cloud; the database lets a user read the accounts of their own hospital.
 */
export function useAccountNames(organizationId: string | undefined) {
  const [names, setNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!organizationId) return;
    let alive = true;
    void (async () => {
      const [{data: members}, {data: auth}] = await Promise.all([
        supabase.from('profiles').select('id,name').eq('organization_id', organizationId),
        supabase.auth.getUser(),
      ]);
      if (!alive) return;
      const map = new Map<string, string>();
      (members || []).forEach(row => map.set(String(row.id), String(row.name || '')));
      // The signed-in account (e.g. SurgiTrack support working in this hospital) is always known.
      const me = auth.user;
      if (me && !map.has(me.id)) {
        const {data: own} = await supabase.from('profiles').select('name').eq('id', me.id).maybeSingle();
        if (alive) map.set(me.id, String(own?.name || me.email || ''));
      }
      if (alive) setNames(map);
    })();
    return () => {
      alive = false;
    };
  }, [organizationId]);
  return names;
}

const plain = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** True when the name the device wrote is not the account's (the account's name is not part of it). */
export const accountDiffers = (writtenName: string, accountName: string | undefined) =>
  !!accountName && !plain(writtenName).includes(plain(accountName));
