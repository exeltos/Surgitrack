import {describe, expect, it} from 'vitest';
import {handoverCheck} from '../handoverPolicy';

describe('handoverCheck', () => {
  const policy = {
    countSetsAtReceipt: false,
    allowCrossDepartmentHandover: true,
    allowCrossDepartmentDelivery: false,
    receiptExemptDepartments: ['ΧΕΙΡΟΥΡΓΕΙΟ'],
    deliveryExemptDepartments: ['ΧΕΙΡΟΥΡΓΕΙΟ', 'ΜΕΤΑΦΟΡΕΙΣ'],
  };

  it('lets a person hand over and receive for their own department', () => {
    expect(handoverCheck('ΜΕΘ', 'ΜΕΘ', policy, 'RECEIPT')).toBe('OK');
    expect(handoverCheck('ΜΕΘ', 'ΜΕΘ', policy, 'DELIVERY')).toBe('OK');
  });

  it('lets an exempt department act for any department, with no reason, at the stage it is exempt in', () => {
    expect(handoverCheck('ΧΕΙΡΟΥΡΓΕΙΟ', 'ΜΕΘ', policy, 'RECEIPT')).toBe('OK');
    expect(handoverCheck('ΧΕΙΡΟΥΡΓΕΙΟ', 'ΜΕΘ', policy, 'DELIVERY')).toBe('OK');
    expect(handoverCheck('ΜΕΤΑΦΟΡΕΙΣ', 'ΜΕΘ', policy, 'DELIVERY')).toBe('OK');
    expect(handoverCheck('ΜΕΤΑΦΟΡΕΙΣ', 'ΜΕΘ', policy, 'RECEIPT')).toBe('REASON');
  });

  it('asks a reason, or refuses, for another department, each way on its own setting', () => {
    expect(handoverCheck('ΜΕΘ', 'ΤΕΠ', policy, 'RECEIPT')).toBe('REASON');
    expect(handoverCheck('ΜΕΘ', 'ΤΕΠ', policy, 'DELIVERY')).toBe('BLOCKED');
    expect(handoverCheck('ΜΕΘ', 'ΤΕΠ', {...policy, allowCrossDepartmentDelivery: true}, 'DELIVERY')).toBe('REASON');
    expect(handoverCheck('ΜΕΘ', 'ΤΕΠ', {...policy, allowCrossDepartmentHandover: false}, 'RECEIPT')).toBe('BLOCKED');
  });

  it('treats a person with no department as another department, never as exempt', () => {
    expect(handoverCheck('', 'ΜΕΘ', policy, 'RECEIPT')).toBe('REASON');
    expect(handoverCheck(undefined, 'ΜΕΘ', policy, 'DELIVERY')).toBe('BLOCKED');
  });
});
