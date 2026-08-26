export type LibraryItem = {id: string; el: string; en: string; active?: boolean; code?: string};
export const departments: LibraryItem[] = [
  {id: 'ster', code: 'STER', el: 'Κεντρική Αποστείρωση', en: 'Central Sterile Services'},
  {id: 'or', code: 'OR', el: 'Χειρουργείο', en: 'Operating Theatre'},
  {id: 'ortho', code: 'ORTHO', el: 'Ορθοπεδική Κλινική', en: 'Orthopaedic Ward'},
  {id: 'gyn', code: 'GYN', el: 'Γυναικολογική Κλινική', en: 'Gynaecology Ward'},
  {id: 'delivery', code: 'DEL', el: 'Αίθουσα Τοκετών', en: 'Delivery Suite'},
  {id: 'ivf', code: 'IVF', el: 'Μονάδα IVF', en: 'IVF Unit'},
  {id: 'icu', code: 'ICU', el: 'ΜΕΘ', en: 'ICU'},
  {id: 'ed', code: 'ED', el: 'ΤΕΠ', en: 'Emergency Department'},
  {id: 'biomed', code: 'BIO', el: 'Βιοϊατρική Υπηρεσία', en: 'Biomedical Engineering'},
  {id: 'proc', code: 'PROC', el: 'Προμήθειες', en: 'Procurement'},
];
export const specialties: LibraryItem[] = [
  {id: 'gen', el: 'Γενική Χειρουργική', en: 'General Surgery'},
  {id: 'ortho', el: 'Ορθοπεδική', en: 'Orthopaedics'},
  {id: 'gyn', el: 'Γυναικολογική', en: 'Gynaecology'},
  {id: 'neuro', el: 'Νευροχειρουργική', en: 'Neurosurgery'},
  {id: 'uro', el: 'Ουρολογία', en: 'Urology'},
];
export const manufacturers: LibraryItem[] = [
  {id: 'aesculap', el: 'AESCULAP', en: 'AESCULAP'},
  {id: 'dewimed', el: 'DEWIMED', en: 'DEWIMED'},
  {id: 'kls', el: 'KLS MARTIN', en: 'KLS MARTIN'},
  {id: 'storz', el: 'KARL STORZ', en: 'KARL STORZ'},
  {id: 'bbraun', el: 'B. BRAUN', en: 'B. BRAUN'},
];
export const suppliers: LibraryItem[] = [
  {id: 'medline', el: 'MedLine Surgical', en: 'MedLine Surgical'},
  {id: 'hellasmed', el: 'Hellas Medical Supplies', en: 'Hellas Medical Supplies'},
  {id: 'biotec', el: 'BioTech Service', en: 'BioTech Service'},
];
export const toolCategories: LibraryItem[] = [
  {id: 'forceps', el: 'Λαβίδες', en: 'Forceps'},
  {id: 'scissors', el: 'Ψαλίδια', en: 'Scissors'},
  {id: 'holders', el: 'Βελονοκάτοχα', en: 'Needle Holders'},
  {id: 'retractors', el: 'Άγκιστρα / Διαστολείς', en: 'Retractors'},
  {id: 'lap', el: 'Λαπαροσκοπικά', en: 'Laparoscopic'},
];
export const sterilizers: LibraryItem[] = [
  {id: 'aut1', code: 'AUT-01', el: 'Κλίβανος Ατμού 01', en: 'Steam Sterilizer 01'},
  {id: 'aut2', code: 'AUT-02', el: 'Κλίβανος Ατμού 02', en: 'Steam Sterilizer 02'},
];
export const demoUsers = [
  {
    id: 'u-admin',
    name: 'Αριστείδης Φιλοκώστας',
    email: 'admin@surgitrack.demo',
    role: 'ADMIN',
    department: 'Κεντρική Αποστείρωση',
  },
  {
    id: 'u-ster',
    name: 'Μαρία Παπαδοπούλου',
    email: 'sterilization@surgitrack.demo',
    role: 'STERILIZATION',
    department: 'Κεντρική Αποστείρωση',
  },
  {id: 'u-or', name: 'Νίκος Δημητρίου', email: 'or@surgitrack.demo', role: 'DEPARTMENT', department: 'Χειρουργείο'},
  {
    id: 'u-gyn',
    name: 'Ελένη Κωνσταντίνου',
    email: 'gyn@surgitrack.demo',
    role: 'DEPARTMENT',
    department: 'Γυναικολογική Κλινική',
  },
] as const;
