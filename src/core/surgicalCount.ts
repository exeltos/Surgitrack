import {normalizeGreek} from './glossary';

/**
 * Departments whose users count the instruments when they send a Set or instrument to Sterilization.
 * Studio sets the list (Libraries → Departments); until it does, every department whose name says
 * operating theatre ("Χειρουργείο", "Κεντρικό Χειρουργείο", "Χειρουργείο Ημέρας" …) counts.
 */
export function countsAtDepartment(department: string | undefined, configured?: readonly string[]): boolean {
  if (!department) return false;
  if (configured) return configured.includes(department);
  return isOperatingTheatre(department);
}

/** The default for departments not yet configured: names that say operating theatre. */
export const isOperatingTheatre = (department: string) => normalizeGreek(department).includes('ΧΕΙΡΟΥΡΓΕΙ');

/** The configured list, or the default one built from the hospital's departments. */
export const countDepartments = (departments: readonly string[], configured?: readonly string[]) =>
  configured ? [...configured] : departments.filter(isOperatingTheatre);
