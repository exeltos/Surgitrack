import {describe, expect, it} from 'vitest';
import {releaseFormBody} from '../printRelease';
import type {ProcessLoadRecord} from '../../../types/domain';

const load: ProcessLoadRecord = {
  id: 'L-1',
  workflowVersion: 1,
  kind: 'STERILIZATION',
  equipment: 'Κλίβανος A',
  cycleNumber: '2026-0001',
  program: '134°C · 5′',
  status: 'OPEN',
  items: [
    {assetId: 's1', assetKind: 'SET', barcode: 'S000001', assetName: 'ΣΕΤ ΓΕΝΙΚΗΣ', department: 'Χειρουργείο'},
    {assetId: 't1', assetKind: 'TOOL', barcode: 'T000001', assetName: 'ΛΑΒΙΔΑ', department: 'ΜΕΘ'},
  ],
  chemicalIndicatorResult: 'NOT_RECORDED',
  createdByUserId: 'u1',
  createdByName: 'Χρήστης',
  createdAt: '07/10/2026 09:00',
};

describe('release form', () => {
  it('prints a blank form for a load in the sterilizer, with a strip space per indicator', () => {
    const html = releaseFormBody({
      load,
      items: load.items.map(i => ({
        barcode: i.barcode,
        name: i.assetName,
        kind: i.assetKind,
        department: i.department,
      })),
      approver: {name: 'Υπεύθυνος', department: 'Κεντρική Αποστείρωση'},
    });
    expect(html).toContain('Έντυπο αποδέσμευσης φορτίου');
    expect(html).toContain('1 Σετ · 1 εργαλείο');
    expect(html.match(/Επικολλήστε εδώ την ταινία του δείκτη/g)).toHaveLength(2);
    expect(html).toContain('Δεν μπήκε στο φορτίο'); // no biological indicator in this load
    expect(html).toContain('Υπεύθυνος');
    expect(html).not.toContain('box on');
  });

  it('fills in the results, the decision and the expiry once released', () => {
    const released: ProcessLoadRecord = {
      ...load,
      status: 'RELEASED',
      chemicalIndicatorResult: 'PASS',
      physicalParametersOk: true,
      packagingIntegrityOk: true,
      releasedAt: '07/10/2026 11:00',
    };
    const html = releaseFormBody({
      load: released,
      items: [{barcode: 'S000001', name: 'ΣΕΤ', kind: 'SET', shelfLifeMonths: 6, sterileUntil: '2027-04-07'}],
      approver: {name: 'Υπεύθυνος'},
      released: {at: '07/10/2026 11:00', decision: 'RELEASED'},
    });
    expect(html).toContain('07/04/2027');
    expect(html).toContain('6 μήνες');
    expect(html.match(/box on/g)?.length).toBe(4); // chemical pass, two checks, released
  });
});
