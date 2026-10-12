import {useEffect, useState} from 'react';
import {loadOlderMatching, useHistoryWindow, type HistoryFilter} from '../../data/cloud/historyWindow';
import type {CloudCollection} from '../../data/cloud/appRecords';

/** The history Traceability reads: moves, surgical counts and per-item cycle records. */
const TRACE_HISTORY: CloudCollection[] = ['movements', 'counts', 'sterilizationCycles'];
/** Typing: the older history is searched once the search has settled. */
const SETTLE_MS = 400;

/** What is being traced: one item (with its Set when it travels in one), or a patient code / free text. */
export type TraceSearch = {
  /** The item and, for a Set member, its Set. */
  assetIds: string[];
  /** Their barcodes, old ones included. */
  barcodes: string[];
  /** A patient code or other text, when no single item was found. */
  text?: string;
  /** The items a patient's moves name, for their cycles. */
  patientBarcodes: string[];
};

/** A value inside a PostgREST `or` filter, quoted so that commas, dots and brackets in it stay text. */
const quoted = (value: string) => `"${value.replace(/[\\"]/g, char => `\\${char}`)}"`;
const like = (column: string, pattern: string) => `${column}.ilike.${quoted(pattern)}`;
const contains = (column: string, text: string) => like(column, `*${text.replace(/\*/g, '')}*`);
const oneOf = (column: string, values: string[]) => `${column}.in.(${values.map(quoted).join(',')})`;

/**
 * The older records a search needs, per collection. Each filter may match more than the page shows (it filters
 * again), never less: a move names its item as "barcode · name", so a barcode prefix finds it.
 */
export function traceFilters(search: TraceSearch): Partial<Record<CloudCollection, HistoryFilter>> {
  const filters: Partial<Record<CloudCollection, HistoryFilter>> = {};
  if (search.barcodes.length) {
    filters.movements = search.barcodes.map(code => like('asset', `${code.replace(/\*/g, '')}*`)).join(',');
    filters.sterilizationCycles = [
      oneOf('asset_id', search.assetIds),
      oneOf('barcode', search.barcodes),
      ...search.assetIds.map(id => `tool_ids.cs.{${quoted(id)}}`),
    ].join(',');
    return filters;
  }
  const text = search.text?.trim();
  if (text) {
    filters.movements = [contains('asset', text), contains('patient_code', text), contains('status', text)].join(',');
    filters.counts = contains('patient_code', text);
  }
  if (search.patientBarcodes.length) filters.sterilizationCycles = oneOf('barcode', search.patientBarcodes);
  return filters;
}

/**
 * Searches the older history (before the window the opening loaded) for what is being traced, and only that:
 * the page then shows an item's or a patient's whole trail without loading the hospital's whole history.
 */
export function useTraceHistory(search: TraceSearch | undefined) {
  const {windowed, loading} = useHistoryWindow(TRACE_HISTORY);
  const key = search && windowed ? JSON.stringify(traceFilters(search)) : '{}';
  const [failed, setFailed] = useState<string>();
  useEffect(() => {
    if (key === '{}') return;
    let live = true;
    const timer = window.setTimeout(() => {
      loadOlderMatching(JSON.parse(key) as Partial<Record<CloudCollection, HistoryFilter>>).then(
        () => live && setFailed(undefined),
        () => live && setFailed(key),
      );
    }, SETTLE_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [key]);
  return {windowed, searching: loading, failed: failed === key && key !== '{}'};
}
