import type {ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {LibraryStoreProvider} from '../../core/LibraryStore';
import {DEMO_HANDOVER_STERILIZATION} from '../../data/cloud/handover';
import {SurgiProvider, useSurgi} from '../SurgiStore';

const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider>
    <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
  </LibraryStoreProvider>
);

describe('Demo handovers', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-data-mode', 'DEMO');
    sessionStorage.setItem('surgitrack-demo-role', 'DEPARTMENT');
  });

  it('a department pickup signed by the Demo Sterilization person counts as confirmed', () => {
    const {result} = renderHook(() => useSurgi(), {wrapper});
    const me = result.current.currentUser;
    const set = result.current.sets.find(s => s.state === 'READY_FOR_PICKUP' && s.department === me.department)!;
    expect(set).toBeTruthy();
    act(() => {
      result.current.completeDeliveryToDepartment('SET', set.id, {
        batchId: 'pickup-test',
        receivedByUserId: me.id,
        receivedByName: me.name,
        receivedByDepartment: me.department || '',
        deliveredBy: {
          userId: DEMO_HANDOVER_STERILIZATION.userId,
          name: DEMO_HANDOVER_STERILIZATION.name,
          department: DEMO_HANDOVER_STERILIZATION.department,
        },
      });
    });
    const record = result.current.deliveries.find(d => d.batchId === 'pickup-test')!;
    expect(record.counterpartyVerified).toBe(true);
  });
});
