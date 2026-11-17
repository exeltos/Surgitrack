import {describe, expect, it} from 'vitest';
import {handoverCheck, renameExemptDepartment, signatureExempt} from '../handoverPolicy';

describe('signatureExempt', () => {
  const policy = {
    countSetsAtReceipt: false,
    allowCrossDepartmentHandover: true,
    allowCrossDepartmentDelivery: true,
    receiptExemptDepartments: ['ΧΕΙΡΟΥΡΓΕΙΟ'],
    deliveryExemptDepartments: ['ΧΕΙΡΟΥΡΓΕΙΟ', 'ΜΕΘ'],
  };

  it('lets a listed department hand over and receive without a signature, at the stage it is listed in', () => {
    expect(signatureExempt('ΧΕΙΡΟΥΡΓΕΙΟ', policy, 'RECEIPT')).toBe(true);
    expect(signatureExempt('ΧΕΙΡΟΥΡΓΕΙΟ', policy, 'DELIVERY')).toBe(true);
    expect(signatureExempt('ΜΕΘ', policy, 'DELIVERY')).toBe(true);
    expect(signatureExempt('ΜΕΘ', policy, 'RECEIPT')).toBe(false);
    expect(signatureExempt('ΤΕΠ', policy, 'RECEIPT')).toBe(false);
    expect(signatureExempt(undefined, policy, 'RECEIPT')).toBe(false);
  });

  it('asks for the signature at a stage whose controlled handover is off', () => {
    expect(signatureExempt('ΧΕΙΡΟΥΡΓΕΙΟ', {...policy, allowCrossDepartmentDelivery: false}, 'DELIVERY')).toBe(false);
    expect(signatureExempt('ΧΕΙΡΟΥΡΓΕΙΟ', {...policy, allowCrossDepartmentHandover: false}, 'RECEIPT')).toBe(false);
  });
});

describe('handoverCheck', () => {
  const policy = {
    countSetsAtReceipt: false,
    allowCrossDepartmentHandover: true,
    allowCrossDepartmentDelivery: false,
    receiptExemptDepartments: ['ΧΕΙΡΟΥΡΓΕΙΟ'],
    deliveryExemptDepartments: ['ΧΕΙΡΟΥΡΓΕΙΟ'],
  };

  it('lets a person hand over and receive for their own department', () => {
    expect(handoverCheck('ΜΕΘ', 'ΜΕΘ', policy, 'RECEIPT')).toBe('OK');
    expect(handoverCheck('ΜΕΘ', 'ΜΕΘ', policy, 'DELIVERY')).toBe('OK');
  });

  it('asks no reason for a Set of a department without the check', () => {
    expect(handoverCheck('ΜΕΘ', 'ΧΕΙΡΟΥΡΓΕΙΟ', policy, 'RECEIPT')).toBe('OK');
    // Delivery is not controlled here, so the list does not count.
    expect(handoverCheck('ΜΕΘ', 'ΧΕΙΡΟΥΡΓΕΙΟ', policy, 'DELIVERY')).toBe('BLOCKED');
  });

  it('asks a reason, or refuses, for another department, each way on its own setting', () => {
    expect(handoverCheck('ΜΕΘ', 'ΤΕΠ', policy, 'RECEIPT')).toBe('REASON');
    expect(handoverCheck('ΜΕΘ', 'ΤΕΠ', policy, 'DELIVERY')).toBe('BLOCKED');
    expect(handoverCheck('ΜΕΘ', 'ΤΕΠ', {...policy, allowCrossDepartmentDelivery: true}, 'DELIVERY')).toBe('REASON');
    expect(handoverCheck('ΜΕΘ', 'ΤΕΠ', {...policy, allowCrossDepartmentHandover: false}, 'RECEIPT')).toBe('BLOCKED');
  });

  it('treats a person with no department as another department', () => {
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
    expect(signatureExempt('ΜΟΝΑΔΑ ΕΝΤΑΤΙΚΗΣ', renamed, 'DELIVERY')).toBe(true);
  });
  it('leaves a policy without the department as it is', () => {
    expect(renameExemptDepartment(policy, 'ΤΕΠ', 'ΕΠΕΙΓΟΝΤΑ')).toBe(policy);
  });
});
