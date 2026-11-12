/**
 * The store is shared through trackedStore: a component is redrawn only when a value it read changes, and
 * actions are stable functions that always run on the latest state. These pin that, and that every function
 * of the store is classified (an unclassified one would be followed like data, so a component holding only
 * actions would be redrawn on every change again, or an action taken for data would never be stable).
 */
import {useRef, type ReactNode} from 'react';
import {act, render, renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {LibraryStoreProvider} from '../../core/LibraryStore';
import {SurgiProvider, useSurgi} from '../SurgiStore';
import {ACTIONS, RENDER_READS} from '../trackedStore';

const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider>
    <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
  </LibraryStoreProvider>
);

describe('the store, shared by what each component reads', () => {
  it('classifies every function of the store as an action or a read used while drawing', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const store = result.current as unknown as Record<string, unknown>;
    const functions = Object.keys(store).filter(key => typeof store[key] === 'function');
    const unclassified = functions.filter(key => !ACTIONS.has(key) && !RENDER_READS.has(key));
    expect(unclassified).toEqual([]);
    // No stale names, and nothing in both lists.
    expect([...ACTIONS, ...RENDER_READS].filter(key => !functions.includes(key))).toEqual([]);
    expect([...ACTIONS].filter(key => RENDER_READS.has(key))).toEqual([]);
  });

  it('redraws a component only when a value it read changes', () => {
    const draws = {tools: 0, actionsOnly: 0, movements: 0};
    let store!: ReturnType<typeof useSurgi>;
    function ReadsTools() {
      const {tools} = useSurgi();
      draws.tools += 1;
      return <span>{tools.length}</span>;
    }
    function ReadsMovements() {
      // The test drives the store through this one, which reads the movements anyway.
      store = useSurgi();
      const {movements} = store;
      draws.movements += 1;
      return <span>{movements.length}</span>;
    }
    function OnlyActions() {
      // Only an action: taken while drawing, called later from a button.
      const {recordCount} = useSurgi();
      const first = useRef(recordCount);
      draws.actionsOnly += 1;
      return <span>{first.current === recordCount ? 'stable' : 'changed'}</span>;
    }
    const {container} = render(
      <LibraryStoreProvider>
        <SurgiProvider dataMode="DEMO">
          <ReadsTools />
          <ReadsMovements />
          <OnlyActions />
        </SurgiProvider>
      </LibraryStoreProvider>,
    );
    const before = {...draws};
    // A change of the movements only (forgetting one of them): the tools did not change.
    const movement = store.movements[0];
    act(() => store.forgetMovements([movement.id]));

    expect(draws.movements).toBeGreaterThan(before.movements);
    expect({tools: draws.tools, actionsOnly: draws.actionsOnly}).toEqual({
      tools: before.tools,
      actionsOnly: before.actionsOnly,
    });
    expect(container.textContent).toContain('stable');
  });

  it('an action taken earlier runs on the latest state', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const forget = result.current.forgetMovements;
    const [first, second] = result.current.movements;
    act(() => forget([first.id]));
    // The same function, called after the state changed: it sees the change and keeps it.
    act(() => forget([second.id]));
    const ids = result.current.movements.map(m => m.id);
    expect(ids).not.toContain(first.id);
    expect(ids).not.toContain(second.id);
    expect(result.current.forgetMovements).toBe(forget);
  });
});
