/** Where the hospital requires the patient code with a dispatch (Organization → Departments). */
export type PatientCodePolicy = {patientCodeDepartments?: readonly string[]};

/**
 * Whether a dispatch from this department must carry the patient code: the departments ticked in Organization →
 * Departments. Limited-use instruments and counted Sets ask for it on their own.
 */
export const patientCodeRequired = (department: string | undefined, policy: PatientCodePolicy) =>
  !!department && (policy.patientCodeDepartments || []).includes(department);
