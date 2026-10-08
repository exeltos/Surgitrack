import {beforeEach, describe, expect, it, vi} from 'vitest';

type Handler = (payload: {new: Record<string, unknown>}) => void;
const bindings: Array<{event: string; table: string; filter: string; handler: Handler}> = [];
let statusCallback: ((status: string) => void) | undefined;
const removeChannel = vi.fn();

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    channel: () => {
      const channel = {
        on: (_type: string, opts: {event: string; table: string; filter: string}, handler: Handler) => {
          bindings.push({...opts, handler});
          return channel;
        },
        subscribe: (cb: (status: string) => void) => {
          statusCallback = cb;
          return channel;
        },
      };
      return channel;
    },
    removeChannel: (...args: unknown[]) => removeChannel(...args),
  },
}));

const {onRemoteChange, isRealtimeLive} = await import('../realtime');
const fire = (event: string, table: string, row: Record<string, unknown> = {}) =>
  bindings.filter(b => b.event === event && b.table === table).forEach(b => b.handler({new: row}));

describe('live changes', () => {
  beforeEach(() => {
    bindings.length = 0;
    removeChannel.mockClear();
  });

  it('listens only to its own hospital and wakes the right collection', () => {
    const sets = vi.fn();
    const issues = vi.fn();
    const stopSets = onRemoteChange('org-1', 'sets', sets);
    const stopIssues = onRemoteChange('org-1', 'issues', issues);
    expect(bindings.length).toBeGreaterThan(0);
    expect(bindings.every(b => b.filter === 'organization_id=eq.org-1')).toBe(true);
    fire('UPDATE', 'instrument_sets');
    expect(sets).toHaveBeenCalledTimes(1);
    expect(issues).not.toHaveBeenCalled();
    fire('INSERT', 'issues');
    expect(issues).toHaveBeenCalledTimes(1);
    stopSets();
    stopIssues();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it('turns a recorded deletion into a change of that collection', () => {
    const tools = vi.fn();
    const stop = onRemoteChange('org-1', 'tools', tools);
    fire('INSERT', 'deleted_records', {collection: 'tools', id: 't1'});
    fire('INSERT', 'deleted_records', {collection: 'sets', id: 's1'});
    expect(tools).toHaveBeenCalledTimes(1);
    stop();
  });

  it('reports whether the live connection is up', () => {
    const stop = onRemoteChange('org-1', 'sets', () => undefined);
    statusCallback?.('SUBSCRIBED');
    expect(isRealtimeLive()).toBe(true);
    statusCallback?.('CHANNEL_ERROR');
    expect(isRealtimeLive()).toBe(false);
    stop();
  });
});
