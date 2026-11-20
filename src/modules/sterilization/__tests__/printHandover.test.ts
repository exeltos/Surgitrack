import {describe, expect, it} from 'vitest';
import {handoverKey, handoverSlipHtml} from '../printHandover';
import type {DeliveryRecord} from '../../../types/domain';

const delivery = (id: string, barcode: string, batchId?: string): DeliveryRecord => ({
  id,
  batchId,
  workflowVersion: 1,
  assetId: id,
  assetKind: 'SET',
  barcode,
  assetName: `Σετ ${barcode}`,
  department: 'Χειρουργείο',
  deliveredByUserId: 'u1',
  deliveredByName: 'Μαρία Αποστείρωση',
  deliveredByDepartment: 'Κεντρική Αποστείρωση',
  receivedByUserId: 'u2',
  receivedByName: 'Νίκος Χειρουργείο',
  receivedByDepartment: 'Χειρουργείο',
  at: '20/11/2026 10:15',
  counterpartyVerified: true,
});

describe('the handover slip', () => {
  it('lists every item of the handover with both people and a line for each to sign', () => {
    const records = [delivery('d1', 'S000321', 'b1'), delivery('d2', 'S000322', 'b1')];
    expect(handoverKey(records[0])).toBe('b1');
    expect(handoverKey(delivery('d3', 'S000323'))).toBe('d3');
    const html = handoverSlipHtml('DELIVERY', records);
    expect(html).toContain('Δελτίο παράδοσης');
    expect(html).toContain('Κεντρική Αποστείρωση → Χειρουργείο');
    expect(html).toContain('S000321');
    expect(html).toContain('S000322');
    expect(html).toContain('Μαρία Αποστείρωση');
    expect(html).toContain('Νίκος Χειρουργείο');
    expect(html).toContain('με τον δικό του κωδικό');
  });
});
