import type {SheetRows} from '../../core/sheetImport';

// The owner's staff import: what is read from the uploaded list of employees (Excel or CSV) before anyone is chosen.
// The server (supabase/functions/import-staff) checks everything again; this is for showing the owner the problems.

export type StaffRole = 'DEPARTMENT' | 'STERILIZATION' | 'VIEWER';

export type StaffRow = {
  /** Position in the file, for choosing and for the answer. */
  id: number;
  name: string;
  /** The department as the file spells it. */
  departmentGiven: string;
  /** The hospital's department it matched, or '' when none did. */
  departmentId: string;
  role: StaffRole;
  /** The mobile number as the file has it (the initial password); only masked on screen. */
  phone: string;
  email: string;
  /** What is wrong, as codes (see `problemText`), empty when the row can be activated. */
  problems: string[];
  /** Already a member of the hospital (same name): shown, not selectable. */
  existing: boolean;
};

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-ZΑ-Ω0-9]+/g, ' ')
    .trim();

/** The name as the hospital records it: capitals, single spaces. */
export const cleanStaffName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('el-GR');
const NAME = /^[A-ZΑ-ΩΆΈΉΊΌΎΏΪΫ][A-ZΑ-ΩΆΈΉΊΌΎΏΪΫ .'-]*$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The initial password (digits of the mobile number, +30 dropped), or null when it is not a plausible number. At least
 * 10 digits, as the sign-in service takes no shorter password: a shorter number abroad needs its country code.
 */
export const phonePassword = (value: string) => {
  let digits = String(value ?? '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  digits = digits.replace(/\D/g, '');
  if (digits.startsWith('0030')) digits = digits.slice(4);
  else if (digits.startsWith('30') && digits.length === 12) digits = digits.slice(2);
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
};

/** 691••••678: enough to recognise the number, not to read it. */
export const maskPhone = (value: string) => {
  const digits = phonePassword(value);
  if (!digits) return value ? '•••' : '';
  return `${digits.slice(0, 3)}${'•'.repeat(Math.max(0, digits.length - 6))}${digits.slice(-3)}`;
};

const HEADERS: Record<'name' | 'surname' | 'first' | 'department' | 'phone' | 'email' | 'role', string[]> = {
  name: [
    'ΟΝΟΜΑΤΕΠΩΝΥΜΟ',
    'ΕΠΩΝΥΜΟ ΟΝΟΜΑ',
    'ΟΝΟΜΑ ΕΠΩΝΥΜΟ',
    'ΕΡΓΑΖΟΜΕΝΟΣ',
    'ΥΠΑΛΛΗΛΟΣ',
    'FULL NAME',
    'NAME',
    'EMPLOYEE',
  ],
  surname: ['ΕΠΩΝΥΜΟ', 'SURNAME', 'LAST NAME'],
  first: ['ΟΝΟΜΑ', 'FIRST NAME'],
  department: ['ΤΜΗΜΑ', 'ΥΠΗΡΕΣΙΑ', 'ΚΛΙΝΙΚΗ', 'ΜΟΝΑΔΑ', 'DEPARTMENT', 'WARD', 'UNIT'],
  phone: ['ΚΙΝΗΤΟ', 'ΚΙΝΗΤΟ ΤΗΛΕΦΩΝΟ', 'ΤΗΛΕΦΩΝΟ', 'ΤΗΛ', 'MOBILE', 'PHONE', 'CELL'],
  email: [
    'EMAIL',
    'E MAIL',
    'PERSONAL EMAIL',
    'ΠΡΟΣΩΠΙΚΟ EMAIL',
    'ΠΡΟΣΩΠΙΚΟ E MAIL',
    'ΗΛΕΚΤΡΟΝΙΚΟ ΤΑΧΥΔΡΟΜΕΙΟ',
    'ΠΡΟΣΩΠΙΚΟ ΗΛΕΚΤΡΟΝΙΚΟ ΤΑΧΥΔΡΟΜΕΙΟ',
  ],
  role: ['ΡΟΛΟΣ', 'ΙΔΙΟΤΗΤΑ', 'ROLE'],
};

const column = (header: string[], key: keyof typeof HEADERS) => header.findIndex(h => HEADERS[key].includes(h));

const ROLE_WORDS: Array<[StaffRole, string[]]> = [
  ['STERILIZATION', ['ΑΠΟΣΤΕΙΡΩΣΗ', 'ΧΡΗΣΤΗΣ ΑΠΟΣΤΕΙΡΩΣΗΣ', 'STERILIZATION', 'CSSD']],
  ['VIEWER', ['ΠΑΡΑΤΗΡΗΤΗΣ', 'ΜΟΝΟ ΠΡΟΒΟΛΗ', 'VIEWER', 'READ ONLY']],
  ['DEPARTMENT', ['ΤΜΗΜΑ', 'ΧΡΗΣΤΗΣ ΤΜΗΜΑΤΟΣ', 'DEPARTMENT', 'ΝΟΣΗΛΕΥΤΗΣ', 'ΝΟΣΗΛΕΥΤΡΙΑ']],
];

/** The hospital's department a cell names: by name or code, then by a name that starts or contains it (only if one does). */
export function matchDepartment(given: string, departments: Array<{id: string; name: string; code: string | null}>) {
  const key = fold(given);
  if (!key) return '';
  const exact = departments.filter(d => fold(d.name) === key || (d.code && fold(d.code) === key));
  if (exact.length === 1) return exact[0].id;
  const near = departments.filter(d => fold(d.name).startsWith(key) || key.startsWith(fold(d.name)));
  if (near.length === 1) return near[0].id;
  return '';
}

/**
 * Reads the sheet: a header row names the columns (name or surname + first name, department, mobile, optional email
 * and role); without one the columns are taken as name, department, mobile, email, role.
 */
export function parseStaffSheet(
  sheet: SheetRows,
  departments: Array<{id: string; name: string; code: string | null}>,
  existingNames: Set<string>,
): StaffRow[] {
  const rows = sheet.filter(r => r.some(cell => String(cell ?? '').trim()));
  if (!rows.length) return [];
  const header = rows[0].map(c => fold(String(c ?? '')));
  const surname = column(header, 'surname');
  const first = column(header, 'first');
  const named = column(header, 'name');
  const hasHeader = named >= 0 || (surname >= 0 && first >= 0) || column(header, 'phone') >= 0;
  const at = (key: keyof typeof HEADERS, fallback: number) => (hasHeader ? column(header, key) : fallback);
  const cols = {
    name: hasHeader ? named : 0,
    department: at('department', 1),
    phone: at('phone', 2),
    email: at('email', 3),
    role: at('role', 4),
  };
  const body = hasHeader ? rows.slice(1) : rows;
  const cell = (row: string[], index: number) => (index >= 0 ? String(row[index] ?? '').trim() : '');
  return body.map((row, i) => {
    const split = hasHeader && cols.name < 0 && surname >= 0 && first >= 0;
    const name = cleanStaffName(split ? `${cell(row, first)} ${cell(row, surname)}` : cell(row, cols.name));
    const departmentGiven = cell(row, cols.department);
    const phone = cell(row, cols.phone);
    const email = cell(row, cols.email).toLowerCase();
    const roleGiven = fold(cell(row, cols.role));
    const role = roleGiven ? (ROLE_WORDS.find(([, words]) => words.includes(roleGiven))?.[0] ?? null) : 'DEPARTMENT';
    const departmentId = matchDepartment(departmentGiven, departments);
    const problems: string[] = [];
    if (!name || !NAME.test(name)) problems.push('name');
    if (!role) problems.push('role');
    if (role !== 'VIEWER' && !departmentId) problems.push('department');
    if (!phonePassword(phone)) problems.push('phone');
    if (email && !EMAIL.test(email)) problems.push('email');
    return {
      id: i,
      name,
      departmentGiven,
      departmentId,
      role: role ?? 'DEPARTMENT',
      phone,
      email,
      problems,
      existing: existingNames.has(name),
    };
  });
}

/** What the server answers for a person it did not make. */
export const importErrorText = (code: string, el: boolean) => {
  const text: Record<string, [string, string]> = {
    invalid_name: ['Μη έγκυρο όνομα', 'Invalid name'],
    invalid_role: ['Μη έγκυρος ρόλος', 'Invalid role'],
    invalid_department: ['Άγνωστο τμήμα', 'Unknown department'],
    invalid_phone: [
      'Μη έγκυρο κινητό (10 ψηφία· από το εξωτερικό με κωδικό χώρας)',
      'Invalid mobile number (10 digits; from abroad with the country code)',
    ],
    invalid_email: ['Μη έγκυρο email', 'Invalid email'],
    already_exists: ['Υπάρχει ήδη', 'Already exists'],
    email_taken: ['Το email χρησιμοποιείται ήδη', 'The email is already used'],
    username_failed: ['Δεν φτιάχτηκε όνομα χρήστη', 'No username could be made'],
    audit_failed: ['Δεν καταγράφηκε, δεν δημιουργήθηκε', 'Could not be recorded, not created'],
    create_failed: ['Δεν δημιουργήθηκε', 'Not created'],
    request_failed: ['Η αποστολή απέτυχε', 'The request failed'],
  };
  const pair = text[code] || ['Δεν δημιουργήθηκε', 'Not created'];
  return el ? pair[0] : pair[1];
};
