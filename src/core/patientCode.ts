/** Where the hospital requires the patient code with a dispatch (Settings → Sterilization). */
export type PatientCodePolicy = {patientCodeRequired?: boolean; patientCodeDepartments?: readonly string[]};

/**
 * Whether a dispatch from this department must carry the patient code: only when the hospital turned the rule on
 * and chose the department. Limited-use instruments and counted Sets ask for it on their own.
 */
export const patientCodeRequired = (department: string | undefined, policy: PatientCodePolicy) =>
  !!policy.patientCodeRequired && !!department && (policy.patientCodeDepartments || []).includes(department);
