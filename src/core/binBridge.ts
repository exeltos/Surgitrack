import type {BinEntry} from '../types/domain';

/** A deletion made outside the main store (Studio libraries), before the store gives it an id and a name. */
export type BinDraft = Omit<BinEntry, 'id' | 'deletedByName'>;

const listeners = new Set<(draft: BinDraft) => void>();

/** The store listens here for deletions made in the libraries, which live in a store above it. */
export const onBinDraft = (listener: (draft: BinDraft) => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const emitBinDraft = (draft: BinDraft) => listeners.forEach(listener => listener(draft));
