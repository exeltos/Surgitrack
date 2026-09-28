import {departments, specialties, toolCategories} from './libraries';

/**
 * Built-in Greek → English medical glossary (no external service), used to show names that
 * hospitals type in Greek — departments, specialties, library entries — in the English UI.
 * Matching ignores accents, case and extra spaces. A whole-name match wins; otherwise the name
 * is translated word by word, but only when every Greek word is known. Anything else stays as
 * the hospital wrote it.
 */

/** Uppercase, accent-free, single-spaced: "Αίθουσα  τοκετών" → "ΑΙΘΟΥΣΑ ΤΟΚΕΤΩΝ". */
export const normalizeGreek = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleUpperCase('el-GR')
    .replace(/\s*([/&,-])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();

/** Whole names (hospital departments, units, specialties, CSSD terms). */
const PHRASES: Array<[string, string]> = [
  // Departments and units
  ['Κεντρική Αποστείρωση', 'Central Sterile Services'],
  ['Αποστείρωση', 'Sterilization'],
  ['Τμήμα Αποστείρωσης', 'Sterilization Department'],
  ['Χειρουργείο', 'Operating Theatre'],
  ['Χειρουργεία', 'Operating Theatres'],
  ['Κεντρικό Χειρουργείο', 'Main Operating Theatre'],
  ['Χειρουργείο Ημέρας', 'Day Surgery'],
  ['Αίθουσα Τοκετών', 'Delivery Suite'],
  ['Μαιευτήριο', 'Maternity Unit'],
  ['Μαιευτική Κλινική', 'Obstetrics Ward'],
  ['Μαιευτική Γυναικολογική Κλινική', 'Obstetrics & Gynaecology Ward'],
  ['ΜΕΘ', 'ICU'],
  ['Μονάδα Εντατικής Θεραπείας', 'Intensive Care Unit'],
  ['ΜΕΝΝ', 'NICU'],
  ['Μονάδα Εντατικής Νοσηλείας Νεογνών', 'Neonatal Intensive Care Unit'],
  ['ΜΑΦ', 'HDU'],
  ['Μονάδα Αυξημένης Φροντίδας', 'High Dependency Unit'],
  ['ΜΕΘ Παίδων', 'Paediatric ICU'],
  ['ΤΕΠ', 'Emergency Department'],
  ['Τμήμα Επειγόντων Περιστατικών', 'Emergency Department'],
  ['Επείγοντα', 'Emergency'],
  ['Μονάδα IVF', 'IVF Unit'],
  ['Μονάδα Εξωσωματικής Γονιμοποίησης', 'IVF Unit'],
  ['Μονάδα Τεχνητού Νεφρού', 'Dialysis Unit'],
  ['Αιμοδυναμικό Εργαστήριο', 'Cardiac Catheterization Lab'],
  ['Ενδοσκοπικό Τμήμα', 'Endoscopy Unit'],
  ['Ενδοσκοπήσεις', 'Endoscopy'],
  ['Εξωτερικά Ιατρεία', 'Outpatient Clinics'],
  ['Ακτινολογικό Τμήμα', 'Radiology Department'],
  ['Ακτινολογικό', 'Radiology'],
  ['Μικροβιολογικό Εργαστήριο', 'Microbiology Laboratory'],
  ['Βιοϊατρική Υπηρεσία', 'Biomedical Engineering'],
  ['Βιοϊατρική Τεχνολογία', 'Biomedical Engineering'],
  ['Τεχνική Υπηρεσία', 'Technical Services'],
  ['Προμήθειες', 'Procurement'],
  ['Γραφείο Προμηθειών', 'Procurement Office'],
  ['Φαρμακείο', 'Pharmacy'],
  ['Αποθήκη', 'Warehouse'],
  ['Διοίκηση', 'Administration'],
  ['Νοσηλευτική Υπηρεσία', 'Nursing Service'],
  ['Διαχείριση', 'Administration'],
  ['Οδοντιατρείο', 'Dental Clinic'],
  ['Οδοντιατρική Κλινική', 'Dental Clinic'],
  // Specialties
  ['Γενική Χειρουργική', 'General Surgery'],
  ['Ορθοπεδική', 'Orthopaedics'],
  ['Ορθοπαιδική', 'Orthopaedics'],
  ['Γυναικολογία', 'Gynaecology'],
  ['Μαιευτική', 'Obstetrics'],
  ['Νευροχειρουργική', 'Neurosurgery'],
  ['Ουρολογία', 'Urology'],
  ['Καρδιοχειρουργική', 'Cardiac Surgery'],
  ['Θωρακοχειρουργική', 'Thoracic Surgery'],
  ['Αγγειοχειρουργική', 'Vascular Surgery'],
  ['Πλαστική Χειρουργική', 'Plastic Surgery'],
  ['Παιδοχειρουργική', 'Paediatric Surgery'],
  ['Οφθαλμολογία', 'Ophthalmology'],
  ['Ωτορινολαρυγγολογία', 'ENT'],
  ['ΩΡΛ', 'ENT'],
  ['Γναθοχειρουργική', 'Maxillofacial Surgery'],
  ['Στοματική και Γναθοπροσωπική Χειρουργική', 'Oral & Maxillofacial Surgery'],
  ['Λαπαροσκοπική Χειρουργική', 'Laparoscopic Surgery'],
  ['Ρομποτική Χειρουργική', 'Robotic Surgery'],
  ['Βαριατρική Χειρουργική', 'Bariatric Surgery'],
  ['Καρδιολογία', 'Cardiology'],
  ['Παθολογία', 'Internal Medicine'],
  ['Παιδιατρική', 'Paediatrics'],
  ['Νεογνολογία', 'Neonatology'],
  ['Αναισθησιολογία', 'Anaesthesiology'],
  ['Γαστρεντερολογία', 'Gastroenterology'],
  ['Πνευμονολογία', 'Pulmonology'],
  ['Δερματολογία', 'Dermatology'],
  ['Οδοντιατρική', 'Dentistry'],
  // Instrument categories and CSSD terms
  ['Λαβίδες', 'Forceps'],
  ['Ψαλίδια', 'Scissors'],
  ['Βελονοκάτοχα', 'Needle Holders'],
  ['Άγκιστρα', 'Retractors'],
  ['Διαστολείς', 'Dilators'],
  ['Λαπαροσκοπικά', 'Laparoscopic'],
  ['Ενδοσκοπικά', 'Endoscopic'],
  ['Νυστέρια', 'Scalpels'],
  ['Λαβές Νυστεριού', 'Scalpel Handles'],
  ['Αιμοστατικές Λαβίδες', 'Haemostatic Forceps'],
  ['Ανατομικές Λαβίδες', 'Dissecting Forceps'],
  ['Χειρουργικές Λαβίδες', 'Surgical Forceps'],
  ['Κοχλίες', 'Screws'],
  ['Πλάκες', 'Plates'],
  ['Τρυπάνια', 'Drills'],
  ['Περιέκτες', 'Containers'],
  ['Κοντέινερ', 'Containers'],
  ['Κλίβανος', 'Sterilizer'],
  ['Κλίβανος Ατμού', 'Steam Sterilizer'],
  ['Πλυντήριο', 'Washer-Disinfector'],
  ['Πλυντικό Απολυμαντικό', 'Washer-Disinfector'],
  ['Υπέρηχοι', 'Ultrasonic Cleaner'],
];

/** Single words, for names made of known parts ("Ουρολογική Κλινική" → "Urology Ward"). */
const WORDS: Array<[string, string]> = [
  ['Κλινική', 'Ward'],
  ['Τμήμα', 'Department'],
  ['Μονάδα', 'Unit'],
  ['Εργαστήριο', 'Laboratory'],
  ['Ιατρείο', 'Clinic'],
  ['Ιατρεία', 'Clinics'],
  ['Υπηρεσία', 'Service'],
  ['Αίθουσα', 'Room'],
  ['Αίθουσες', 'Rooms'],
  ['Κέντρο', 'Centre'],
  ['Κεντρική', 'Central'],
  ['Κεντρικό', 'Main'],
  ['Γενική', 'General'],
  ['Γενικό', 'General'],
  ['Α', 'A'],
  ['Β', 'B'],
  ['Γ', 'C'],
  ['Δ', 'D'],
  ['Ε', 'E'],
  ['Α΄', 'A'],
  ['Β΄', 'B'],
  ['Γ΄', 'C'],
  ['Παίδων', 'Paediatric'],
  ['Παιδιατρική', 'Paediatric'],
  ['Παιδοχειρουργική', 'Paediatric Surgery'],
  ['Χειρουργική', 'Surgical'],
  ['Χειρουργικό', 'Surgical'],
  ['Χειρουργείο', 'Operating Theatre'],
  ['Χειρουργεία', 'Operating Theatres'],
  ['Παθολογική', 'Internal Medicine'],
  ['Ορθοπεδική', 'Orthopaedic'],
  ['Ορθοπαιδική', 'Orthopaedic'],
  ['Γυναικολογική', 'Gynaecology'],
  ['Μαιευτική', 'Obstetrics'],
  ['Ουρολογική', 'Urology'],
  ['Νευροχειρουργική', 'Neurosurgery'],
  ['Νευρολογική', 'Neurology'],
  ['Καρδιολογική', 'Cardiology'],
  ['Καρδιοχειρουργική', 'Cardiac Surgery'],
  ['Θωρακοχειρουργική', 'Thoracic Surgery'],
  ['Αγγειοχειρουργική', 'Vascular Surgery'],
  ['Πλαστική', 'Plastic Surgery'],
  ['Οφθαλμολογική', 'Ophthalmology'],
  ['Οφθαλμιατρική', 'Ophthalmology'],
  ['Ωτορινολαρυγγολογική', 'ENT'],
  ['ΩΡΛ', 'ENT'],
  ['Γναθοχειρουργική', 'Maxillofacial Surgery'],
  ['Οδοντιατρική', 'Dental'],
  ['Πνευμονολογική', 'Pulmonology'],
  ['Γαστρεντερολογική', 'Gastroenterology'],
  ['Δερματολογική', 'Dermatology'],
  ['Νεφρολογική', 'Nephrology'],
  ['Αιματολογική', 'Haematology'],
  ['Ογκολογική', 'Oncology'],
  ['Ψυχιατρική', 'Psychiatry'],
  ['Αναισθησιολογικό', 'Anaesthesiology'],
  ['Αναισθησιολογικό Τμήμα', 'Anaesthesiology Department'],
  ['Ενδοσκοπικό', 'Endoscopy'],
  ['Ακτινολογικό', 'Radiology'],
  ['Μικροβιολογικό', 'Microbiology'],
  ['Βιοχημικό', 'Biochemistry'],
  ['Αιμοδοσία', 'Blood Bank'],
  ['Φαρμακείο', 'Pharmacy'],
  ['Αποθήκη', 'Warehouse'],
  ['Αποστείρωση', 'Sterilization'],
  ['Αποστείρωσης', 'Sterilization'],
  ['Ημέρας', 'Day'],
  ['Βραχείας', 'Short-Stay'],
  ['Νοσηλείας', 'Care'],
  ['Εντατικής', 'Intensive'],
  ['Θεραπείας', 'Care'],
  ['Νεογνών', 'Neonatal'],
  ['Ενηλίκων', 'Adult'],
  ['Επειγόντων', 'Emergency'],
  ['Επείγοντα', 'Emergency'],
  ['Τοκετών', 'Delivery'],
  ['Εξωτερικά', 'Outpatient'],
  ['και', '&'],
  ['/', '/'],
  ['&', '&'],
  ['-', '-'],
];

const phraseMap = new Map<string, string>();
const wordMap = new Map<string, string>();
// The built-in libraries already carry their own English; they are part of the glossary too.
[...departments, ...specialties, ...toolCategories].forEach(item => {
  if (item.en && item.en !== item.el) phraseMap.set(normalizeGreek(item.el), item.en);
});
PHRASES.forEach(([el, en]) => phraseMap.set(normalizeGreek(el), en));
WORDS.forEach(([el, en]) => wordMap.set(normalizeGreek(el), en));

const HEAD_NOUNS = new Set([
  'Ward',
  'Department',
  'Unit',
  'Laboratory',
  'Clinic',
  'Clinics',
  'Service',
  'Room',
  'Rooms',
  'Centre',
]);

const hasGreek = (value: string) => /[Ͱ-Ͽἀ-῿]/.test(value);

/** The English for a Greek name, or undefined when the glossary cannot translate all of it. */
export const translateToEnglish = (greek: string): string | undefined => {
  const key = normalizeGreek(greek);
  if (!key) return undefined;
  if (!hasGreek(key)) return greek.trim();
  const phrase = phraseMap.get(key);
  if (phrase) return phrase;
  const words = key.split(' ');
  const out: string[] = [];
  for (const word of words) {
    if (!hasGreek(word)) {
      out.push(word);
      continue;
    }
    const english = wordMap.get(word) ?? phraseMap.get(word);
    if (!english) return undefined;
    out.push(english);
  }
  // Greek puts the head noun first ("Τμήμα Επειγόντων", "Κλινική Παίδων"); English puts it last.
  if (out.length > 1 && HEAD_NOUNS.has(out[0])) out.push(out.shift()!);
  return out.join(' ').replace(/\s+/g, ' ').trim();
};

/**
 * What to show for a name in the current language: the stored English when it is a real
 * translation, else the glossary's, else the name as the hospital wrote it.
 */
export const localizedName = (greek: string, lang: 'el' | 'en', storedEnglish?: string) => {
  if (lang === 'el') return greek;
  if (storedEnglish && storedEnglish.trim() && storedEnglish !== greek) return storedEnglish;
  return translateToEnglish(greek) ?? greek;
};
