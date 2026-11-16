import {describe, expect, it} from 'vitest';
import {handoverCheck} from '../handoverPolicy';

describe('handoverCheck', () => {
  const policy = {
    countSetsAtReceipt: false,
    allowCrossDepartmentHandover: true,
    allowCrossDepartmentDelivery: false,
    exemptDepartments: ['ΧΕΙΡΟΥΡΓΕΙΟ'],
  };

  it('lets a person hand over and receive for their own department', () => {
    expect(handoverCheck('ΜΕΘ', 'ΜΕΘ', policy, 'RECEIPT')).toBe('OK');
    expect(handoverCheck('ΜΕΘ', 'ΜΕΘ', policy, 'DELIVERY')).toBe('OK');
  });

  it('lets an exempt department act for any department, with no reason', () => {
    expect(handoverCheck('ΧΕΙΡΟΥΡΓΕΙΟ', 'ΜΕΘ', policy, 'RECEIPT')).toBe('OK');
    expect(handoverCheck('ΧΕΙΡΟΥΡΓΕΙΟ', 'ΜΕΘ', policy, 'DELIVERY')).toBe('OK');
  });

  it('asks a reason, or refuses, for another department, each way on its own setting', () => {
    expect(handoverCheck('ΜΕΘ', 'ΤΕΠ', policy, 'RECEIPT')).toBe('REASON');
    expect(handoverCheck('ΜΕΘ', 'ΤΕΠ', policy, 'DELIVERY')).toBe('BLOCKED');
    expect(handoverCheck('ΜΕΘ', 'ΤΕΠ', {...policy, allowCrossDepartmentDelivery: true}, 'DELIVERY')).toBe('REASON');
    expect(handoverCheck('ΜΕΘ', 'ΤΕΠ', {...policy, allowCrossDepartmentHandover: false}, 'RECEIPT')).toBe('BLOCKED');
  });
});
