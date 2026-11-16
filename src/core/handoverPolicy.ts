import type {SterilizationReceiptPolicy} from './workflow';

/**
 * Whether a person may hand over (at receipt) or receive (at delivery) a Set of a department: «OK» when it is their
 * own department or theirs is exempt (the theatre, the porters…), «REASON» when another department is allowed with
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
  if (personDepartment && policy?.exemptDepartments?.includes(personDepartment)) return 'OK';
  const allowed =
    at === 'RECEIPT' ? (policy?.allowCrossDepartmentHandover ?? true) : !!policy?.allowCrossDepartmentDelivery;
  return allowed ? 'REASON' : 'BLOCKED';
}
