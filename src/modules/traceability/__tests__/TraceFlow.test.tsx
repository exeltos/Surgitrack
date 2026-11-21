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
    status: 'RELEASED',
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
      'Αποστολή',
      'Παραλαβή',
      'Καθαρισμός',
      'Σύνθεση',
      'Κλίβανος',
      'Αποδέσμευση',
      'Παράδοση',
      'Ασθενής',
    ]);
    expect(steps[1]).toHaveTextContent('← Χειρουργείο');
    expect(steps[2]).toHaveClass('is-empty');
    expect(steps[4]).toHaveTextContent('Κλίβανος Ατμού 02');
    // The cycle's result here; its release is said once, in «Αποδέσμευση».
    expect(steps[4]).toHaveTextContent('Επιτυχία');
    expect(steps[4]).not.toHaveTextContent('Αποδεσμεύτηκε');
    expect(steps[0]).toHaveClass('is-empty');
    expect(steps[4]).toHaveTextContent('Νίκος');
    expect(steps[5]).toHaveTextContent('12/11/2026 08:30');
    expect(steps[6]).toHaveTextContent('→ Χειρουργείο');
    fireEvent.click(within(steps[7]).getByRole('button', {name: 'PT-2026-0177'}));
    expect(onPatient).toHaveBeenCalledWith('PT-2026-0177');
    fireEvent.click(within(steps[4]).getByRole('button', {name: 'Φορτίο'}));
    expect(onLoad).toHaveBeenCalledWith('L1');
  });

  it('keeps a recall a recall, a signed count with the patient, and a transfer with its endpoints', () => {
    const r: Round = {
      key: 'r2',
      moves: [
        move('a', 'ΑΝΑΚΛΗΣΗ φορτίου 2026-0927', '13/11/2026 10:00', {patientCode: 'PT-1'}),
        move('b', 'Μεταφορά εργαλείου σε Set', '13/11/2026 11:00', {from: 'Set S000321', to: 'Set S000341'}),
        move('c', 'Καταμέτρηση εργαλείων υπογεγραμμένη · 9/9', '14/11/2026 12:00', {patientCode: 'PT-2'}),
      ],
    };
    render(<TraceFlow rounds={[r]} undone={new Set()} onPatient={vi.fn()} onLoad={vi.fn()} />);
    const steps = screen.getAllByRole('listitem').filter(li => li.classList.contains('trace-flow-step'));
    expect(steps[5]).toHaveTextContent('ΑΝΑΚΛΗΣΗ φορτίου 2026-0927');
    expect(within(steps[5]).getByRole('button', {name: 'PT-1'})).toBeInTheDocument();
    expect(steps[7]).toHaveTextContent('Καταμέτρηση εργαλείων υπογεγραμμένη');
    expect(steps[7]).not.toHaveTextContent('PT-1');
    expect(screen.getByText(/Set S000321 → Set S000341/)).toBeInTheDocument();
  });

  it('puts a send without a patient code under «Αποστολή», leaving «Ασθενής» empty, and the load moves once', () => {
    const r: Round = {
      key: 'r3',
      cycle: {...round.cycle!, id: 'L9', loadId: 'L9'},
      moves: [
        move('s', 'Αποστολή προς αποστείρωση', '18/11/2026 13:22', {from: 'ΜΕΘ', by: 'ΣΑΡΡΟΣ'}),
        move('l', 'Φορτίο L9 · ΚΛΙΒΑΝΟΣ Α · κύκλος 3 · σε εξέλιξη', '19/11/2026 12:47', {to: 'Στον κλίβανο'}),
        move('r', 'Φορτίο L9 · ΚΛΙΒΑΝΟΣ Α · 3 · επιτυχές', '19/11/2026 13:25', {by: 'Ελένη'}),
      ],
    };
    render(<TraceFlow rounds={[r]} undone={new Set()} onPatient={vi.fn()} onLoad={vi.fn()} />);
    const steps = screen.getAllByRole('listitem').filter(li => li.classList.contains('trace-flow-step'));
    expect(steps[0]).toHaveTextContent('← ΜΕΘ');
    expect(steps[0]).toHaveTextContent('ΣΑΡΡΟΣ');
    expect(steps[7]).toHaveClass('is-empty');
    expect(screen.queryByText(/Στον κλίβανο/)).toBeNull();
    // Who loaded it and who recorded its result, both on the cycle.
    expect(steps[4]).toHaveTextContent('Νίκος · Μαρία · Ελένη');
  });

  it('says a failed wash, with its washer, in «Καθαρισμός»', () => {
    const r: Round = {
      key: 'r4',
      moves: [
        move('w', 'Φορτίο πλυντηρίου W1 · Πλυντήριο 2 · 14 · ΑΠΟΤΥΧΙΑ', '18/11/2026 14:00', {
          from: 'Καθαρισμός',
          to: 'Καθαρισμός',
        }),
      ],
    };
    render(<TraceFlow rounds={[r]} undone={new Set()} onPatient={vi.fn()} onLoad={vi.fn()} />);
    const wash = screen.getAllByRole('listitem').find(li => li.classList.contains('wash'))!;
    const action = within(wash).getByText(/Πλυντήριο 2 · 14 · ΑΠΟΤΥΧΙΑ/);
    expect(action).toHaveClass('failed');
  });

  it('says an undo and its reason, and shows a patient as plain text without access to Ιχνηλάτηση', () => {
    const r: Round = {
      key: 'r5',
      moves: [
        move('u', 'Αναίρεση: Παραλαβή στην Αποστείρωση', '18/11/2026 15:00', {undoes: 'x', note: 'Λάθος Σετ'}),
        move('p', 'Αποστολή προς αποστείρωση', '18/11/2026 16:00', {patientCode: 'PT-9'}),
      ],
    };
    render(<TraceFlow rounds={[r]} undone={new Set()} />);
    expect(screen.getByText('Αιτιολογία: Λάθος Σετ')).toBeInTheDocument();
    expect(screen.getByText(/Αναίρεση: Παραλαβή/)).toBeInTheDocument();
    expect(screen.getByText('PT-9')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'PT-9'})).toBeNull();
  });

  it('keeps what a move adds after its name, a deviation on receipt as a problem', () => {
    const r: Round = {
      key: 'r6',
      moves: [move('d', 'Φυσική παραλαβή · εμφανής απόκλιση', '18/11/2026 15:00')],
    };
    render(<TraceFlow rounds={[r]} undone={new Set()} />);
    expect(screen.getByText('εμφανής απόκλιση')).toHaveClass('failed');
  });

  it('keeps the details of a send with the patient (the instruments not used)', () => {
    const r: Round = {
      key: 'r7',
      moves: [
        move('s', 'Ηλεκτρονική αποστολή · Μαρία (u1) · χωρίς χρήση: T000012', '18/11/2026 16:00', {
          patientCode: 'PT-7',
        }),
      ],
    };
    render(<TraceFlow rounds={[r]} undone={new Set()} />);
    expect(screen.getByText(/χωρίς χρήση: T000012/)).toBeInTheDocument();
  });

  it('says in full a move that is not its stage routine (a replacement in the composition)', () => {
    const r: Round = {
      key: 'r8',
      moves: [move('x', 'Αντικατάσταση στη σύνθεση από T000099', '18/11/2026 16:00', {to: 'Σύνθεση'})],
    };
    render(<TraceFlow rounds={[r]} undone={new Set()} />);
    expect(screen.getByText('Αντικατάσταση στη σύνθεση από T000099')).toBeInTheDocument();
  });

  it('does not show «χωρίς εμφανή απόκλιση» as a problem', () => {
    const r: Round = {key: 'r9', moves: [move('k', 'Φυσική παραλαβή · χωρίς εμφανή απόκλιση', '21/11/2026 12:48')]};
    render(<TraceFlow rounds={[r]} undone={new Set()} />);
    expect(screen.getByText('χωρίς εμφανή απόκλιση')).not.toHaveClass('failed');
  });
});
