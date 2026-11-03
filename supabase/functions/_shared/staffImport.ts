// What the owner's staff import accepts, shared by import-staff and its tests.

/** The roles an import may give (never an administrator: only the platform owner makes one, by hand). */
export const IMPORT_ROLES = new Set(["DEPARTMENT", "STERILIZATION", "VIEWER"]);
/** At most this many people in one request (the screen sends them in batches). */
export const MAX_IMPORT_ROWS = 50;
export const DEFAULT_DEADLINE_DAYS = 7;
export const MAX_DEADLINE_DAYS = 30;

// Names are stored in capitals (Greek or Latin letters, spaces, hyphens), as on hospital records.
export const NAME = /^[A-ZΑ-ΩΆΈΉΊΌΎΏΪΫ][A-ZΑ-ΩΆΈΉΊΌΎΏΪΫ .'-]*$/u;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** People with no email of their own get one that can never receive mail (.invalid is reserved for that). */
export const placeholderEmail = (userCode: string) => `${userCode.toLowerCase()}@staff.surgitrack.invalid`;

export const cleanName = (value: unknown) =>
  String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("el-GR");

/**
 * The initial password is the person's mobile number: digits only, a Greek country code dropped
 * (+30 69… and 0030 69… become 69…). Returns null for anything that is not a plausible number.
 */
export const phonePassword = (value: unknown) => {
  let digits = String(value ?? "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  digits = digits.replace(/\D/g, "");
  if (digits.startsWith("0030")) digits = digits.slice(4);
  else if (digits.startsWith("30") && digits.length === 12) digits = digits.slice(2);
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
};
