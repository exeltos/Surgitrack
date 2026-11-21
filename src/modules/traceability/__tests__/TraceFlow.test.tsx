import {fireEvent, render, screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {Movement} from '../../../types/domain';
import TraceFlow from '../TraceFlow';
import type {Round} from '../traceModel';

const move = (id: string, status: string, at: string, extra: Partial<Movement> = {}): Movement => ({
  id,
  asset: 'S000341 · ΑΓΓΕΙΟΧΕΙΡΟΥΡΓΙΚΟ',
  assetKind: 'SET',
  from: 'Χειρουργείο',
  to: 'Κεντρική Αποστείρωση',
  status,
  at,
  by: 'Μαρία',
  ...extra,
});

const round: Round = {
  key: 'r1',
  cycle: {
    id: 'L1',
    loadId: 'L1',
    start: '12/11/2026 07:00',
    at: '12/11/2026 08:00',
    sterilizer: 'Κλίβανος Ατμού 02',
    cycleNumber: '2026-0927',
    label: 'Αποδεσμεύτηκε',
    tone: 'ok',
    by: 'Νίκος',
    releasedAt: '12/11/2026 08:30',
  },
  moves: [
    move('m1', 'Παραλαβή στην Αποστείρωση', '11/11/2026 11:40'),
    move('m2', 'Παράδοση στο τμήμα', '12/11/2026 09:20', {from: 'Κεντρική Αποστείρωση', to: 'Χειρουργείο'}),
    move('m3', 'Αποστολή προς αποστείρωση', '18/11/2026 16:20', {patientCode: 'PT-2026-0177'}),
  ],
};

describe('TraceFlow', () => {
  it('shows a round as its stages in order: receipt, sterilizer, release, delivery, patient', () => {
    const onPatient = vi.fn();
    const onLoad = vi.fn();
    render(<TraceFlow rounds={[round]} undone={new Set()} onPatient={onPatient} onLoad={onLoad} />);
    const steps = screen.getAllByRole('listitem').filter(li => li.classList.contains('trace-flow-step'));
    expect(steps.map(s => s.querySelector('strong')?.textContent)).toEqual([
      'Παραλαβή',
      'Καθαρισμός',
      'Σύνθεση',
      'Κλίβανος',
      'Αποδέσμευση',
      'Παράδοση',
      'Ασθενής',
    ]);
    expect(steps[0]).toHaveTextContent('← Χειρουργείο');
    expect(steps[1]).toHaveClass('is-empty');
    expect(steps[3]).toHaveTextContent('Κλίβανος Ατμού 02');
    expect(steps[3]).toHaveTextContent('Νίκος');
    expect(steps[4]).toHaveTextContent('12/11/2026 08:30');
    expect(steps[5]).toHaveTextContent('→ Χειρουργείο');
    fireEvent.click(within(steps[6]).getByRole('button', {name: 'PT-2026-0177'}));
    expect(onPatient).toHaveBeenCalledWith('PT-2026-0177');
    fireEvent.click(within(steps[3]).getByRole('button', {name: 'Φορτίο'}));
    expect(onLoad).toHaveBeenCalledWith('L1');
  });
});
