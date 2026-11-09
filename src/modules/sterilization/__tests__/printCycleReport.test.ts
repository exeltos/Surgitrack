import {describe, expect, it} from 'vitest';
import {buildCycleData} from '../../../core/cycleSimulator';
import type {ProcessLoadRecord} from '../../../types/domain';
import {cycleChartSvg, cycleReportBody} from '../printCycleReport';

const loadWith = (
  scenario: 'PASS' | 'LOW_PRESSURE',
): ProcessLoadRecord & {cycleData: ReturnType<typeof buildCycleData>} => ({
  id: 'L1',
  workflowVersion: 1,
  kind: 'STERILIZATION',
  equipment: 'Κλίβανος Ατμού 01',
  cycleNumber: '2026-0932',
  program: '134°C · 5 min',
  status: 'AWAITING_RELEASE',
  items: [
    {assetId: 's1', assetKind: 'SET', barcode: 'S000334', assetName: 'ΥΣΤΕΡΟΣΚΟΠΗΣΗΣ <b>', department: 'Γυναικολογική'},
  ],
  createdByUserId: 'u',
  createdByName: 'Χρήστης',
  createdAt: '09/11/2026 10:00',
  cycleData: buildCycleData('134°C · 5 min', scenario, '09/11/2026 10:00', '09/11/2026 10:20'),
});

describe('cycleReportBody', () => {
  it('reports a passed simulated cycle with its readings, the items and the simulation mark', () => {
    const html = cycleReportBody({load: loadWith('PASS'), hospital: 'ΙΑΣΩ'});
    expect(html).toContain('2026-0932');
    expect(html).toContain('134 °C');
    expect(html).toContain('Οι παράμετροι του κύκλου τηρήθηκαν.');
    expect(html).toContain('Προσομοίωση: οι τιμές είναι δοκιμαστικές');
    expect(html).toContain('S000334');
    expect(html).toContain('<svg class="chart"');
    expect(html).toContain('Δεν έχει αποδεσμευτεί ακόμα');
  });

  it('escapes names and says why a cycle failed', () => {
    const html = cycleReportBody({load: loadWith('LOW_PRESSURE')});
    expect(html).not.toContain('<b>"');
    expect(html).toContain('ΥΣΤΕΡΟΣΚΟΠΗΣΗΣ &lt;b&gt;');
    expect(html).toContain('Οι παράμετροι του κύκλου δεν τηρήθηκαν.');
    expect(html).toContain('Η πίεση έπεσε κάτω από το όριο');
    expect(html).toMatch(/1\.[45]\d bar \(ελάχιστη\)/);
  });

  it('shows the release when the load has been released', () => {
    const html = cycleReportBody({
      load: loadWith('PASS'),
      release: {at: '09/11/2026 11:00', by: 'Αριστείδης', decision: 'RELEASED'},
    });
    expect(html).toContain('Αποδεσμεύτηκε · 09/11/2026 11:00');
  });
});

describe('cycleChartSvg', () => {
  it('draws the temperature and the pressure', () => {
    const svg = cycleChartSvg(loadWith('PASS').cycleData);
    expect(svg.match(/<path /g)).toHaveLength(2);
  });
});
