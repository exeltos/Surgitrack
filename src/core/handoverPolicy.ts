import type {SterilizationReceiptPolicy} from './workflow';

/**
 * Whether a department's Sets and instruments go through a stage without a signature: the hospital listed it among
 * the departments without the check at that stage (the theatre, say), while that stage's controlled handover is on.
 * The receipt then records who sent them electronically; the delivery, the department itself.
 */
export function signatureExempt(
  itemDepartment: string | undefined,
  policy: Partial<SterilizationReceiptPolicy> | undefined,
  at: 'RECEIPT' | 'DELIVERY',
) {
  const controlled =
    at === 'RECEIPT' ? (policy?.allowCrossDepartmentHandover ?? true) : !!policy?.allowCrossDepartmentDelivery;
  const list = at === 'RECEIPT' ? policy?.receiptExemptDepartments : policy?.deliveryExemptDepartments;
  return controlled && !!itemDepartment && !!list?.includes(itemDepartment);
}

/**
 * Whether a person may hand over (at receipt) or receive (at delivery) a Set of a department: «OK» when it is their
 * own department or the Set's department needs no signature at that stage, «REASON» when another department is
 * allowed with a written reason, «BLOCKED» when it is not allowed at all.
 */
export type HandoverCheck = 'OK' | 'REASON' | 'BLOCKED';

export function handoverCheck(
  personDepartment: string | undefined,
  itemDepartment: string | undefined,
  policy: Partial<SterilizationReceiptPolicy> | undefined,
  at: 'RECEIPT' | 'DELIVERY',
): HandoverCheck {
  // The same department (as before: both left empty counts as the same).
  if ((personDepartment || '') === (itemDepartment || '')) return 'OK';
  if (signatureExempt(itemDepartment, policy, at)) return 'OK';
  const allowed =
    at === 'RECEIPT' ? (policy?.allowCrossDepartmentHandover ?? true) : !!policy?.allowCrossDepartmentDelivery;
  return allowed ? 'REASON' : 'BLOCKED';
}

/** The policy with a renamed department's exemptions carried over to its new name; the same policy when it had none. */
export function renameExemptDepartment<P extends SterilizationReceiptPolicy>(policy: P, from: string, to: string): P {
  const rename = (list?: string[]) => (list?.includes(from) ? list.map(d => (d === from ? to : d)) : list);
  const receipt = rename(policy.receiptExemptDepartments);
  const delivery = rename(policy.deliveryExemptDepartments);
  if (receipt === policy.receiptExemptDepartments && delivery === policy.deliveryExemptDepartments) return policy;
  return {...policy, receiptExemptDepartments: receipt, deliveryExemptDepartments: delivery};
}
