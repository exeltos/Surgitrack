import type {LibraryItem} from '../core/libraries';
import type {SessionUser, UserRole} from '../store/types';

/** Library code of the sterilization service; it is the Sterilization role, not a department role. */
const STERILIZATION_DEPARTMENT_CODE = 'STER';

/** Header choice in Demo: Admin, Sterilization (staff or supervisor), or one department from the library. */
export type DemoView = 'ADMIN' | 'VIEWER' | 'STERILIZATION' | 'STERILIZATION_SUPERVISOR' | `DEPARTMENT:${string}`;

/** The kinds of hospital user, named the same everywhere (Demo buttons, "view as", Studio). */
export type HospitalRoleKind = 'ADMIN' | 'STERILIZATION_SUPERVISOR' | 'STERILIZATION' | 'DEPARTMENT' | 'VIEWER';
export const hospitalRoleNames: Record<HospitalRoleKind, {el: string; en: string}> = {
  ADMIN: {el: 'Διαχειριστής νοσοκομείου', en: 'Hospital administrator'},
  STERILIZATION_SUPERVISOR: {el: 'Προϊστάμενος Αποστείρωσης', en: 'Sterilization supervisor'},
  STERILIZATION: {el: 'Χρήστης Αποστείρωσης', en: 'Sterilization user'},
  DEPARTMENT: {el: 'Χρήστης Τμήματος', en: 'Department user'},
  VIEWER: {el: 'Παρατηρητής (μόνο προβολή)', en: 'Viewer (read only)'},
};
export const hospitalRoleKinds = Object.keys(hospitalRoleNames) as HospitalRoleKind[];

export const demoDepartments = (departments: readonly LibraryItem[]) =>
  departments.filter(d => (d.code || '').toUpperCase() !== STERILIZATION_DEPARTMENT_CODE);

/** The demo identity for a header choice; a department view works as that department's user. */
export const demoSessionUser = (view: DemoView, departments: readonly LibraryItem[]): SessionUser => {
  if (view === 'ADMIN') return {id: 'demo-admin', name: 'Demo Διαχειριστής', role: 'ADMIN', department: 'Διαχείριση'};
  if (view === 'VIEWER')
    return {id: 'demo-viewer', name: 'Demo Νοσηλευτική Διεύθυνση', role: 'VIEWER', department: 'Διοίκηση'};
  const sterilization = departments.find(d => (d.code || '').toUpperCase() === STERILIZATION_DEPARTMENT_CODE);
  if (view === 'STERILIZATION')
    return {
      id: 'demo-sterilization',
      name: 'Demo Αποστείρωση',
      role: 'STERILIZATION',
      department: sterilization?.el || 'Κεντρική Αποστείρωση',
    };
  if (view === 'STERILIZATION_SUPERVISOR')
    return {
      id: 'demo-sterilization-supervisor',
      name: 'Demo Προϊστάμενος Αποστείρωσης',
      role: 'STERILIZATION',
      department: sterilization?.el || 'Κεντρική Αποστείρωση',
      supervisor: true,
    };
  const departmentId = view.slice('DEPARTMENT:'.length);
  const department = demoDepartments(departments).find(d => d.id === departmentId) || demoDepartments(departments)[0];
  return {
    id: `demo-department-${department?.id || 'unit'}`,
    name: `Demo · ${department?.el || 'Τμήμα'}`,
    role: 'DEPARTMENT',
    department: department?.el || 'Τμήμα',
  };
};

/** The header choice matching the current role and identity. */
export const currentDemoView = (role: UserRole, user: SessionUser, departments: readonly LibraryItem[]): DemoView => {
  if (role === 'STERILIZATION') return user.supervisor ? 'STERILIZATION_SUPERVISOR' : 'STERILIZATION';
  if (role !== 'DEPARTMENT') return role;
  const department = demoDepartments(departments).find(d => d.el === user.department);
  return `DEPARTMENT:${department?.id || demoDepartments(departments)[0]?.id || ''}`;
};

/**
 * An admin working as another role or department of their own hospital: the actions stay theirs,
 * so the history records their name with the role they were working as.
 */
export const viewAsSessionUser = (
  view: DemoView,
  departments: readonly LibraryItem[],
  admin: {id: string; name: string},
): SessionUser => {
  const target = demoSessionUser(view, departments);
  const as =
    view === 'ADMIN'
      ? 'Διαχειριστής νοσοκομείου'
      : target.supervisor
        ? `Προϊστάμενος · ${target.department}`
        : target.department;
  return {
    id: admin.id,
    name: `${admin.name} (ως ${as})`,
    role: target.role,
    department: target.department,
    ...(target.supervisor ? {supervisor: true} : {}),
    viewAs: true,
  };
};

/** Stores the demo identity so the stores and a page reload pick it up. */
export const applyDemoSessionUser = (user: SessionUser) => {
  sessionStorage.setItem('surgitrack-session-user', JSON.stringify(user));
  sessionStorage.setItem('surgitrack-demo-role', user.role);
};
