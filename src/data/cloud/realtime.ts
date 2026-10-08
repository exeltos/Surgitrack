import {useSyncExternalStore} from 'react';
import type {RealtimeChannel} from '@supabase/supabase-js';
import {supabase} from '../../lib/supabase';
import {CLOUD_TABLES} from './cloudTables';
import type {CloudCollection} from './appRecords';

/**
 * Live changes: one Supabase Realtime channel per hospital. Any insert or update in a synced table, and any
 * deletion (recorded in deleted_records), wakes the collection's sync so it fetches what changed at once
 * instead of at its next periodic look. The database's row-level rules decide what each device hears.
 */
type Listener = () => void;
const listeners = new Map<CloudCollection, Set<Listener>>();
const tableCollection = new Map<string, CloudCollection>(
  (Object.entries(CLOUD_TABLES) as Array<[CloudCollection, {table: string}]>).map(([c, spec]) => [spec.table, c]),
);
let channel: RealtimeChannel | undefined;
let channelOrg: string | undefined;
let live = false;
const statusListeners = new Set<() => void>();
const setLive = (value: boolean) => {
  if (live === value) return;
  live = value;
  statusListeners.forEach(listener => listener());
};

const emit = (collection: CloudCollection | undefined) => {
  if (!collection) return;
  listeners.get(collection)?.forEach(listener => listener());
};

const open = (organizationId: string) => {
  if (channel && channelOrg === organizationId) return;
  close();
  channelOrg = organizationId;
  const filter = `organization_id=eq.${organizationId}`;
  let next = supabase.channel(`surgitrack-${organizationId}`);
  for (const table of tableCollection.keys())
    next = next.on('postgres_changes', {event: 'INSERT', schema: 'public', table, filter}, () =>
      emit(tableCollection.get(table)),
    );
  for (const table of tableCollection.keys())
    next = next.on('postgres_changes', {event: 'UPDATE', schema: 'public', table, filter}, () =>
      emit(tableCollection.get(table)),
    );
  next = next.on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'deleted_records', filter}, payload =>
    emit((payload.new as {collection?: CloudCollection}).collection),
  );
  channel = next.subscribe(status => setLive(status === 'SUBSCRIBED'));
};

const close = () => {
  if (channel) void supabase.removeChannel(channel);
  channel = undefined;
  channelOrg = undefined;
  setLive(false);
};

/** Calls `onChange` when another device changes the collection. Returns the unsubscribe. */
export function onRemoteChange(organizationId: string, collection: CloudCollection, onChange: Listener) {
  open(organizationId);
  const set = listeners.get(collection) || new Set<Listener>();
  set.add(onChange);
  listeners.set(collection, set);
  return () => {
    set.delete(onChange);
    if (![...listeners.values()].some(group => group.size)) close();
  };
}

/** Whether live changes are connected (otherwise the sync falls back to looking every few seconds). */
export const isRealtimeLive = () => live;
export const useRealtimeLive = () =>
  useSyncExternalStore(
    listener => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    () => live,
  );
