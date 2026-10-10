import {
  BookOpen,
  Building2,
  Factory,
  FlaskConical,
  Stethoscope,
  Warehouse,
  WashingMachine,
  type LucideIcon,
} from 'lucide-react';
import {type LibraryKey} from '../../core/LibraryStore';
import type {UserRole} from '../../store/types';
import {type PermissionGroup} from '../../core/permissions';

export type Tab =
  | 'OVERVIEW'
  | 'PLATFORM'
  | 'LIBRARIES'
  | 'WORKFLOW'
  | 'USERS'
  | 'IMPORT'
  | 'GUIDE'
  | 'ROLES'
  | 'SYSTEM'
  | 'ERRORS'
  | 'NOTICES';

export const roles: Array<{id: UserRole; el: string; en: string; descriptionEl: string; descriptionEn: string}> = [
  {
    id: 'ADMIN',
    el: 'Διαχειριστής',
    en: 'Administrator',
    descriptionEl: 'Πλήρης διαχείριση SurgiTrack, βιβλιοθηκών, χρηστών και ρυθμίσεων.',
    descriptionEn: 'Full SurgiTrack, libraries, users and configuration access.',
  },
  {
    id: 'STERILIZATION',
    el: 'Αποστείρωση',
    en: 'Sterilization',
    descriptionEl:
      'Παραλαβή, έλεγχος, σύνθεση, κλιβανισμός και παράδοση. Ο Προϊστάμενος, που ορίζει ο διαχειριστής νοσοκομείου, καταχωρεί εργαλεία και Σετ, αλλάζει τη σύνθεσή τους και διαχειρίζεται το Service.',
    descriptionEn:
      'Receipt, inspection, assembly, sterilization and delivery. The supervisor, named by the hospital admin, registers instruments and Sets, changes their composition and handles service.',
  },
  {
    id: 'DEPARTMENT',
    el: 'Τμήμα',
    en: 'Department',
    descriptionEl: 'Προβολή των assets του τμήματος, αναφορές και ηλεκτρονική αποστολή προς Αποστείρωση.',
    descriptionEn: 'View department assets, report issues and electronically dispatch to Sterilization.',
  },
  {
    id: 'VIEWER',
    el: 'Παρατηρητής',
    en: 'Viewer',
    descriptionEl:
      'Μόνο προβολή (π.χ. Νοσηλευτική Διεύθυνση, Διεύθυνση Λειτουργιών): επισκόπηση, μητρώα, εκκρεμότητες, ιστορικό και αναφορές όλου του νοσοκομείου. Δεν αλλάζει τίποτα.',
    descriptionEn:
      'Read only (e.g. Nursing Directorate, Operations): overview, registries, issues, history and reports of the whole hospital. Changes nothing.',
  },
];

export const permissionGroupMeta: Record<PermissionGroup, {el: string; en: string}> = {
  ASSETS: {el: 'Σετ, εργαλεία & Απόθεμα', en: 'Assets & Stock'},
  WORKFLOW: {el: 'Ροές εργασίας', en: 'Workflow'},
  TRACEABILITY: {el: 'Ιχνηλασιμότητα & Αναφορές', en: 'Traceability & Reports'},
  ADMIN: {el: 'Διαχείριση συστήματος', en: 'System administration'},
};

export const libraryMeta: Array<{
  key: LibraryKey;
  el: string;
  en: string;
  icon: LucideIcon;
  hintEl: string;
  hintEn: string;
}> = [
  {
    key: 'departments',
    el: 'Τμήματα',
    en: 'Departments',
    icon: Building2,
    hintEl: 'Κοινή λίστα τμημάτων για χρήστες, Σετ και εργαλεία.',
    hintEn: 'Shared departments used by users, sets and instruments.',
  },
  {
    key: 'specialties',
    el: 'Ειδικότητες',
    en: 'Specialties',
    icon: Stethoscope,
    hintEl: 'Χειρουργικές / κλινικές ειδικότητες.',
    hintEn: 'Surgical and clinical specialties.',
  },
  {
    key: 'manufacturers',
    el: 'Κατασκευαστές',
    en: 'Manufacturers',
    icon: Factory,
    hintEl: 'Κατασκευαστές εργαλείων και Σετ.',
    hintEn: 'Instrument and set manufacturers.',
  },
  {
    key: 'suppliers',
    el: 'Προμηθευτές',
    en: 'Suppliers',
    icon: Warehouse,
    hintEl: 'Προμηθευτές και συνεργάτες service.',
    hintEn: 'Suppliers and service partners.',
  },
  {
    key: 'toolCategories',
    el: 'Κατηγορίες εργαλείων',
    en: 'Instrument categories',
    icon: BookOpen,
    hintEl: 'Κοινές κατηγορίες ταξινόμησης εργαλείων.',
    hintEn: 'Shared instrument classification categories.',
  },
  {
    key: 'sterilizers',
    el: 'Κλίβανοι',
    en: 'Sterilizers',
    icon: FlaskConical,
    hintEl: 'Κλίβανοι που χρησιμοποιούνται στους κύκλους αποστείρωσης.',
    hintEn: 'Sterilizers available for sterilization cycles.',
  },
  {
    key: 'washers',
    el: 'Πλυντήρια',
    en: 'Washers',
    icon: WashingMachine,
    hintEl: 'Πλυντήρια / απολυμαντές που επιλέγονται στη φόρτωση πλυντηρίου.',
    hintEn: 'Washer-disinfectors picked in the washer load.',
  },
];
