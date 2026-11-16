import {describe, expect, it} from 'vitest';
import {handoverCheck, renameExemptDepartment} from '../handoverPolicy';

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
    const controlled = {...policy, allowCrossDepartmentDelivery: true};
    expect(handoverCheck('ΧΕΙΡΟΥΡΓΕΙΟ', 'ΜΕΘ', controlled, 'RECEIPT')).toBe('OK');
    expect(handoverCheck('ΧΕΙΡΟΥΡΓΕΙΟ', 'ΜΕΘ', controlled, 'DELIVERY')).toBe('OK');
    expect(handoverCheck('ΜΕΤΑΦΟΡΕΙΣ', 'ΜΕΘ', controlled, 'DELIVERY')).toBe('OK');
    expect(handoverCheck('ΜΕΤΑΦΟΡΕΙΣ', 'ΜΕΘ', controlled, 'RECEIPT')).toBe('REASON');
  });

  it('ignores the exemptions of a stage whose controlled handover is off', () => {
    expect(handoverCheck('ΧΕΙΡΟΥΡΓΕΙΟ', 'ΜΕΘ', policy, 'DELIVERY')).toBe('BLOCKED');
    expect(handoverCheck('ΧΕΙΡΟΥΡΓΕΙΟ', 'ΜΕΘ', {...policy, allowCrossDepartmentHandover: false}, 'RECEIPT')).toBe(
      'BLOCKED',
    );
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

describe('renameExemptDepartment', () => {
  const policy = {
    countSetsAtReceipt: false,
    allowCrossDepartmentHandover: true,
    allowCrossDepartmentDelivery: true,
    receiptExemptDepartments: ['ΧΕΙΡΟΥΡΓΕΙΟ', 'ΜΕΘ'],
    deliveryExemptDepartments: ['ΜΕΘ'],
  };
  it('carries the exemptions over to the new name', () => {
    const renamed = renameExemptDepartment(policy, 'ΜΕΘ', 'ΜΟΝΑΔΑ ΕΝΤΑΤΙΚΗΣ');
    expect(renamed.receiptExemptDepartments).toEqual(['ΧΕΙΡΟΥΡΓΕΙΟ', 'ΜΟΝΑΔΑ ΕΝΤΑΤΙΚΗΣ']);
    expect(renamed.deliveryExemptDepartments).toEqual(['ΜΟΝΑΔΑ ΕΝΤΑΤΙΚΗΣ']);
    expect(handoverCheck('ΜΟΝΑΔΑ ΕΝΤΑΤΙΚΗΣ', 'ΧΕΙΡΟΥΡΓΕΙΟ', renamed, 'DELIVERY')).toBe('OK');
  });
  it('leaves a policy without the department as it is', () => {
    expect(renameExemptDepartment(policy, 'ΤΕΠ', 'ΕΠΕΙΓΟΝΤΑ')).toBe(policy);
  });
});
