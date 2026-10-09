import type {UserRole} from '../../store/types';
import {hospitalRoleNames} from '../../config/demoRoles';

export type Department = {id: string; name: string; code: string | null; active: boolean};

export type Request = {
  id: string;
  full_name: string;
  email: string;
  status: 'PENDING_EMAIL' | 'PENDING' | 'APPROVED' | 'REJECTED';
  department_id: string | null;
  requested_at: string;
  /** The account made at signup, inactive until approval. */
  user_id: string | null;
  /** The username made at signup. */
  user_code: string | null;
  /** A personal invitation: its form's link, the role the admin picked (and supervisor). */
  invite_token: string | null;
  invited_role: UserRole | null;
  supervisor: boolean;
  invited_at: string | null;
};

export type Member = {
  id: string;
  name: string;
  email: string;
  user_code: string | null;
  role: UserRole;
  supervisor: boolean;
  active: boolean;
  department_id: string | null;
  demo_enabled: boolean;
};

export type Decision = {role: string; departmentId: string; note: string};

export type Draft = {
  name: string;
  email: string;
  role: string;
  departmentId: string;
  active: boolean;
  demoEnabled: boolean;
};

export type CsvRow = {
  name: string;
  email: string;
  role: string;
  departmentId: string;
  department: string;
  error?: string;
};

export const STERILIZATION_CODE = 'STER';

export const SUPERVISOR = 'STERILIZATION_SUPERVISOR';

export const roles: Array<{id: string; el: string; en: string}> = [
  {id: 'DEPARTMENT', ...hospitalRoleNames.DEPARTMENT},
  {id: 'STERILIZATION', ...hospitalRoleNames.STERILIZATION},
  {id: SUPERVISOR, ...hospitalRoleNames.STERILIZATION_SUPERVISOR},
  {id: 'ADMIN', ...hospitalRoleNames.ADMIN},
  {id: 'VIEWER', ...hospitalRoleNames.VIEWER},
];

export const wholeHospital = (role: string) => role === 'ADMIN' || role === 'VIEWER';

export const roleValue = (m: Pick<Member, 'role' | 'supervisor'>) =>
  m.role === 'STERILIZATION' && m.supervisor ? SUPERVISOR : m.role;

export const accountRole = (role: string) => (role === SUPERVISOR ? 'STERILIZATION' : role) as UserRole;

export const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteResult = {
  email: string;
  ok: boolean;
  mode?: 'account' | 'signup';
  user_code?: string;
  emailed?: boolean;
  url?: string;
  error?: string;
};

export const functionError = async (error: unknown, given?: string) => {
  if (given) return given;
  const context = (error as {context?: Response} | null)?.context;
  if (context && typeof context.json === 'function') {
    const body = (await context.json().catch(() => null)) as {error?: string} | null;
    if (body?.error) return String(body.error);
  }
  return (error as {message?: string} | null)?.message || '';
};
