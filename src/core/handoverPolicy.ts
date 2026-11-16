import type {SterilizationReceiptPolicy} from './workflow';

/**
 * Whether a person may hand over (at receipt) or receive (at delivery) a Set of a department: «OK» when it is their
 * own department or theirs is exempt at that stage while it is controlled (the theatre, the porters…), «REASON» when another department is allowed with
 * a written reason, «BLOCKED» when it is not allowed at all.
 */
export type HandoverCheck = 'OK' | 'REASON' | 'BLOCKED';

export function handoverCheck(
  personDepartment: string | undefined,
  itemDepartment: string | undefined,
  policy: Partial<SterilizationReceiptPolicy> | undefined,
  at: 'RECEIPT' | 'DELIVERY',
): HandoverCheck {
  // The same department (as before: both left empty counts as the same). A person with no department is not exempt.
  if ((personDepartment || '') === (itemDepartment || '')) return 'OK';
  const allowed =
    at === 'RECEIPT' ? (policy?.allowCrossDepartmentHandover ?? true) : !!policy?.allowCrossDepartmentDelivery;
  if (!allowed) return 'BLOCKED';
  // Exemptions count only while that stage's controlled handover is on (the list is greyed out otherwise).
  const exempt = at === 'RECEIPT' ? policy?.receiptExemptDepartments : policy?.deliveryExemptDepartments;
  if (personDepartment && exempt?.includes(personDepartment)) return 'OK';
  return 'REASON';
}

/** The policy with a renamed department's exemptions carried over to its new name; the same policy when it had none. */
export function renameExemptDepartment<P extends SterilizationReceiptPolicy>(policy: P, from: string, to: string): P {
  const rename = (list?: string[]) => (list?.includes(from) ? list.map(d => (d === from ? to : d)) : list);
  const receipt = rename(policy.receiptExemptDepartments);
  const delivery = rename(policy.deliveryExemptDepartments);
  if (receipt === policy.receiptExemptDepartments && delivery === policy.deliveryExemptDepartments) return policy;
  return {...policy, receiptExemptDepartments: receipt, deliveryExemptDepartments: delivery};
}
