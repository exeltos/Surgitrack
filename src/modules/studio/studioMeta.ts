import {
  BookOpen,
  Building2,
  Factory,
  FlaskConical,
  Stethoscope,
  Warehouse,
  WashingMachine,
  type LucideIcon,
  Bug,
  FileSpreadsheet,
  Gauge,
  Layers3,
  Megaphone,
  MessageSquareHeart,
  Settings2,
  UserCog,
  Users,
} from 'lucide-react';
import {type LibraryKey} from '../../core/LibraryStore';
import type {UserRole} from '../../store/types';
import {type PermissionGroup} from '../../core/permissions';

export type Tab =
  | 'OVERVIEW'
  | 'PLATFORM'
  | 'DEMOS'
  | 'LIBRARIES'
  | 'WORKFLOW'
  | 'USERS'
  | 'IMPORT'
  | 'ROLES'
  | 'SYSTEM'
  | 'ERRORS'
  | 'NOTICES'
  | 'RATINGS';

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

export type StudioTabDef = {id: Tab; el: string; en: string; icon: LucideIcon; group: 'PLATFORM' | 'SETUP'};

/**
 * The platform's own work first (hospitals, users, notices…), then the set-up every hospital has
 * (libraries, flow, roles, settings). A hospital admin sees only the set-up, on one row.
 */
export const STUDIO_TABS: StudioTabDef[] = [
  {id: 'OVERVIEW', el: 'Επισκόπηση', en: 'Overview', icon: Gauge, group: 'PLATFORM'},
  {id: 'PLATFORM', el: 'Νοσοκομεία', en: 'Hospitals', icon: Building2, group: 'PLATFORM'},
  {id: 'USERS', el: 'Χρήστες', en: 'Users', icon: Users, group: 'PLATFORM'},
  {id: 'DEMOS', el: 'Demo αξιολόγησης', en: 'Evaluation Demos', icon: FlaskConical, group: 'PLATFORM'},
  {id: 'IMPORT', el: 'Εισαγωγή', en: 'Import', icon: FileSpreadsheet, group: 'PLATFORM'},
  {id: 'RATINGS', el: 'Αξιολογήσεις', en: 'Ratings', icon: MessageSquareHeart, group: 'PLATFORM'},
  {id: 'NOTICES', el: 'Ειδοποιήσεις', en: 'Notices', icon: Megaphone, group: 'PLATFORM'},
  {id: 'ERRORS', el: 'Σφάλματα', en: 'Errors', icon: Bug, group: 'PLATFORM'},
  {id: 'LIBRARIES', el: 'Βιβλιοθήκες', en: 'Libraries', icon: BookOpen, group: 'SETUP'},
  {id: 'WORKFLOW', el: 'Ροή Αποστείρωσης', en: 'Sterilization Flow', icon: Layers3, group: 'SETUP'},
  {id: 'ROLES', el: 'Ρόλοι & δικαιώματα', en: 'Roles & permissions', icon: UserCog, group: 'SETUP'},
  {id: 'SYSTEM', el: 'Ρυθμίσεις', en: 'Settings', icon: Settings2, group: 'SETUP'},
];
