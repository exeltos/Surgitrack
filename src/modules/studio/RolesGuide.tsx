import {Building2, Crown, ShieldCheck, Sparkles, Stethoscope} from 'lucide-react';
import type {ReactNode} from 'react';
import {useAppPreferences} from '../../core/AppPreferences';
import {hospitalRoleNames} from '../../config/demoRoles';

type Row = {
  icon: ReactNode;
  name: {el: string; en: string};
  who: {el: string; en: string};
  sees: {el: string; en: string};
  does: {el: string; en: string};
};

const rows: Row[] = [
  {
    icon: <Crown size={18} />,
    name: {el: 'Owner πλατφόρμας', en: 'Platform owner'},
    who: {
      el: 'Ο ιδιοκτήτης του SurgiTrack. Δεν ανήκει σε νοσοκομείο.',
      en: 'The owner of SurgiTrack. Belongs to no hospital.',
    },
    sees: {el: 'Όλα τα νοσοκομεία, το Studio και το Demo.', en: 'All hospitals, Studio and the Demo.'},
    does: {
      el: 'Δημιουργεί νοσοκομεία, ορίζει τον Διαχειριστή κάθε νοσοκομείου και μπαίνει σε οποιοδήποτε νοσοκομείο.',
      en: 'Creates hospitals, names each hospital administrator and can enter any hospital.',
    },
  },
  {
    icon: <Building2 size={18} />,
    name: hospitalRoleNames.ADMIN,
    who: {
      el: 'Τον δημιουργεί ο Owner. Δεν ανήκει σε τμήμα.',
      en: 'Created by the owner. Belongs to no department.',
    },
    sees: {
      el: 'Μόνο το δικό του νοσοκομείο: Επισκόπηση, όλα τα τμήματα και όλα τα δεδομένα του.',
      en: 'Only their own hospital: overview, all departments and all its data.',
    },
    does: {
      el: 'Τμήματα, σύνδεσμος εγγραφής, έγκριση χρηστών, ρόλοι, ορισμός Προϊσταμένου Αποστείρωσης, barcode, ρυθμίσεις. Δεν βλέπει άλλα νοσοκομεία.',
      en: 'Departments, signup link, user approval, roles, naming the sterilization supervisor, barcodes, settings. Never sees other hospitals.',
    },
  },
  {
    icon: <ShieldCheck size={18} />,
    name: hospitalRoleNames.STERILIZATION_SUPERVISOR,
    who: {
      el: 'Χρήστης της Αποστείρωσης που ορίζει ο Διαχειριστής.',
      en: 'A sterilization user named by the hospital administrator.',
    },
    sees: {
      el: 'Επισκόπηση νοσοκομείου, Αποστείρωση, Εργαλεία, Σετ, Stock, Αναφορές, Ιστορικό.',
      en: 'Hospital overview, sterilization, instruments, Sets, stock, reports, history.',
    },
    does: {
      el: 'Ό,τι ο Χρήστης Αποστείρωσης, και επιπλέον καταχωρεί εργαλεία και Σετ, εκδίδει barcode, αλλάζει τη σύνθεση των Σετ και διαχειρίζεται το Service.',
      en: 'Everything a sterilization user does, plus registering instruments and Sets, issuing barcodes, changing Set composition and handling service.',
    },
  },
  {
    icon: <Sparkles size={18} />,
    name: hospitalRoleNames.STERILIZATION,
    who: {el: 'Υπάλληλος της Αποστείρωσης.', en: 'Sterilization staff.'},
    sees: {
      el: 'Αποστείρωση, Εργαλεία, Σετ, Stock, Αναφορές, Ιστορικό όλου του νοσοκομείου.',
      en: 'Sterilization, instruments, Sets, stock, reports and history of the whole hospital.',
    },
    does: {
      el: 'Παραλαβή, πλύσιμο, σύνθεση, κλίβανος, παράδοση και αναφορές προβλημάτων.',
      en: 'Receipt, washing, assembly, sterilization, delivery and problem reports.',
    },
  },
  {
    icon: <Stethoscope size={18} />,
    name: hospitalRoleNames.DEPARTMENT,
    who: {
      el: 'Υπάλληλος ενός τμήματος (π.χ. Χειρουργείο). Προϊστάμενος και απλός χρήστης έχουν τα ίδια.',
      en: 'Staff of one department (e.g. operating theatre). Supervisor and staff have the same access.',
    },
    sees: {
      el: 'Μόνο τα Σετ και τα εργαλεία του τμήματός του, τις εκκρεμότητες και το ιστορικό του.',
      en: 'Only their department’s Sets and instruments, its issues and its history.',
    },
    does: {
      el: 'Αποστολή στην Αποστείρωση, παραλαβή και αναφορές προβλημάτων.',
      en: 'Sending to sterilization, receiving back and problem reports.',
    },
  },
];

/** Who is who in SurgiTrack: the platform owner and the four kinds of hospital user. */
export default function RolesGuide() {
  const {lang} = useAppPreferences();
  const L = (text: {el: string; en: string}) => (lang === 'el' ? text.el : text.en);
  return (
    <section className="roles-guide">
      <header>
        <span className="eyebrow">{lang === 'el' ? 'ΠΟΙΟΣ ΕΙΝΑΙ ΠΟΙΟΣ' : 'WHO IS WHO'}</span>
        <h2>{lang === 'el' ? 'Ρόλοι στο SurgiTrack' : 'Roles in SurgiTrack'}</h2>
      </header>
      <div className="roles-guide-table">
        <div className="roles-guide-head">
          <span>{lang === 'el' ? 'Ρόλος' : 'Role'}</span>
          <span>{lang === 'el' ? 'Ποιος είναι' : 'Who'}</span>
          <span>{lang === 'el' ? 'Τι βλέπει' : 'Sees'}</span>
          <span>{lang === 'el' ? 'Τι κάνει' : 'Does'}</span>
        </div>
        {rows.map(row => (
          <div className="roles-guide-row" key={row.name.el}>
            <b>
              {row.icon}
              {L(row.name)}
            </b>
            <span>{L(row.who)}</span>
            <span>{L(row.sees)}</span>
            <span>{L(row.does)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
