import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import type {ProcessLoadRecord} from '../../../types/domain';
import SterilizerBoard from '../parts/SterilizerBoard';

const load = (over: Partial<ProcessLoadRecord>): ProcessLoadRecord => ({
  id: 'L1',
  workflowVersion: 1,
  kind: 'STERILIZATION',
  equipment: 'Κλίβανος Ατμού 01',
  cycleNumber: '2026-0932',
  program: '134°C · 5 min',
  status: 'OPEN',
  items: [{assetId: 'a', assetKind: 'TOOL', barcode: 'T1', assetName: 'Λαβίδα', department: 'Χ'}],
  createdByUserId: 'u',
  createdByName: 'Χ',
  createdAt: '09/11/2026 10:00',
  ...over,
});

describe('SterilizerBoard', () => {
  it('shows every sterilizer: the free ones and the one running a load', () => {
    render(
      <SterilizerBoard
        names={['Κλίβανος Ατμού 01', 'Κλίβανος Ατμού 02']}
        loads={[load({simulation: {scenario: 'PASS', startedAt: Date.now() - 30_000, speed: 20}})]}
      />,
    );
    expect(screen.getByText('Ελεύθερος')).toBeTruthy();
    expect(screen.getByText(/Κλίβανος Ατμού 02/)).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.getByText(/1 σε λειτουργία · 1 ελεύθεροι/)).toBeTruthy();
  });

  it('says so when a load runs without live readings', () => {
    render(<SterilizerBoard names={['Κλίβανος Ατμού 01']} loads={[load({})]} />);
    expect(screen.getByText('Χωρίς ζωντανά δεδομένα')).toBeTruthy();
  });

  it('lists a sterilizer the library does not have when a load runs in it', () => {
    render(<SterilizerBoard names={[]} loads={[load({equipment: 'Κλίβανος Β'})]} />);
    expect(screen.getByText('Κλίβανος Β')).toBeTruthy();
  });
});
