import {ClipboardCheck, IdCard, Pencil, Plus, Save, X} from 'lucide-react';
import {useLibraries} from '../../../core/LibraryStore';
import {useHasModule} from '../../../data/cloud/modulesContext';
import {countDepartments} from '../../../core/surgicalCount';
import AppButton from '../../../components/ui/AppButton';
import {localizedName} from '../../../core/glossary';
import type {PeopleState} from './usePeople';
import {useSurgi} from '../../../store/SurgiStore';

export default function DepartmentsSection({s}: {s: PeopleState}) {
  const {
    L,
    activeDepartments,
    addDepartment,
    departments,
    editing,
    lang,
    members,
    newDepartment,
    ownHospital,
    saveDepartment,
    setEditing,
    setNewDepartment,
    tab,
    toggleDepartment,
  } = s;
  const {sets, currentUser} = useSurgi();
  const libs = useLibraries();
  // What each department does when it sends to Sterilization: count the instruments (with the count module), and
  // whether the patient code is required.
  const withCount = useHasModule('SURGICAL_COUNT');
  const counting = countDepartments(
    departments.map(d => d.name),
    libs.systemSettings.surgicalCountDepartments,
  );
  const patientCode = libs.systemSettings.patientCodeDepartments || [];
  const flip = (list: string[], name: string) =>
    list.includes(name) ? list.filter(item => item !== name) : [...list, name];
  const toggleCount = (name: string) =>
    libs.updateSystemSettings(
      {surgicalCountDepartments: flip(counting, name)},
      currentUser.name,
      'Καταμέτρηση εργαλείων',
    );
  const togglePatientCode = (name: string) =>
    libs.updateSystemSettings({patientCodeDepartments: flip(patientCode, name)}, currentUser.name, 'Κωδικός ασθενούς');
  // What a department holds, so it is clear what changes before it is turned off.
  const holds = (d: {id: string; name: string}) => {
    const users = members.filter(m => m.department_id === d.id).length;
    const setCount = sets.filter(x => x.department === d.name).length;
    return [
      users === 1 ? L('1 χρήστης', '1 user') : L(`${users} χρήστες`, `${users} users`),
      setCount === 1 ? L('1 Σετ', '1 Set') : L(`${setCount} Σετ`, `${setCount} Sets`),
    ].join(' · ');
  };
  return (
    <>
      {tab === 'DEPARTMENTS' && (
        <section className="hospital-card hospital-departments-card">
          <header>
            <div>
              <b>{L('Τμήματα', 'Departments')}</b>
              <small>
                {L(
                  'Εμφανίζονται στη φόρμα εγγραφής, στα Σετ, στα εργαλεία και στην ιχνηλάτηση. Στην αποστολή προς Αποστείρωση: «Καταμέτρηση» μετρά και υπογράφει τα εργαλεία, «Κωδ. ασθενούς» τον κάνει υποχρεωτικό. Το τμήμα της Αποστείρωσης έχει κωδικό STER.',
                  'Shown on the signup form, on Sets, instruments and traceability. When sending to Sterilization: «Count» counts and signs the instruments, «Patient code» makes it required. The Sterilization department has the code STER.',
                )}
              </small>
            </div>
            <span className="hospital-count">{activeDepartments.length}</span>
          </header>
          <div className="hospital-department-add">
            <input
              value={newDepartment.name}
              onChange={e => setNewDepartment(v => ({...v, name: e.target.value}))}
              placeholder={L('Όνομα τμήματος', 'Department name')}
            />
            <input
              value={newDepartment.code}
              onChange={e => setNewDepartment(v => ({...v, code: e.target.value}))}
              placeholder={L('Κωδικός', 'Code')}
            />
            <AppButton
              variant="primary"
              disabled={!newDepartment.name.trim()}
              onClick={() => void addDepartment()}
              icon={<Plus size={15} />}
            >
              {L('Προσθήκη', 'Add')}
            </AppButton>
          </div>
          <div className="hospital-rows">
            {departments.map(d =>
              editing?.id === d.id ? (
                <div key={d.id} className="hospital-row editing">
                  <input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} />
                  <input value={editing.code} onChange={e => setEditing({...editing, code: e.target.value})} />
                  <button onClick={() => void saveDepartment()} aria-label={L('Αποθήκευση', 'Save')}>
                    <Save size={14} />
                  </button>
                  <button onClick={() => setEditing(null)} aria-label={L('Ακύρωση', 'Cancel')}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div key={d.id} className={`hospital-row ${d.active ? '' : 'inactive'}`}>
                  <span>
                    <b>{localizedName(d.name, lang)}</b>
                    <small>
                      {d.code || '—'} · {holds(d)}
                    </small>
                  </span>
                  {/* Sterilization receives, it does not send: nothing to count or to ask for. */}
                  {ownHospital && d.code !== 'STER' && (
                    <span className="hospital-dept-flags">
                      {withCount && (
                        <button
                          type="button"
                          className={`hospital-dept-flag ${counting.includes(d.name) ? 'on' : ''}`}
                          aria-pressed={counting.includes(d.name)}
                          title={L(
                            'Μετρά και υπογράφει τα εργαλεία όταν στέλνει προς Αποστείρωση',
                            'Counts and signs the instruments when it sends to Sterilization',
                          )}
                          onClick={() => toggleCount(d.name)}
                        >
                          <ClipboardCheck size={14} /> {L('Καταμέτρηση', 'Count')}
                        </button>
                      )}
                      <button
                        type="button"
                        className={`hospital-dept-flag ${patientCode.includes(d.name) ? 'on' : ''}`}
                        aria-pressed={patientCode.includes(d.name)}
                        title={L(
                          'Ο κωδικός ασθενούς είναι υποχρεωτικός στην αποστολή προς Αποστείρωση',
                          'The patient code is required when it sends to Sterilization',
                        )}
                        onClick={() => togglePatientCode(d.name)}
                      >
                        <IdCard size={14} /> {L('Κωδ. ασθενούς', 'Patient code')}
                      </button>
                    </span>
                  )}
                  <button
                    className={`studio-access-toggle ${d.active ? 'active' : ''}`}
                    onClick={() => void toggleDepartment(d)}
                  >
                    <span></span>
                    {d.active ? L('Ενεργό', 'Active') : L('Ανενεργό', 'Inactive')}
                  </button>
                  <button
                    onClick={() => setEditing({id: d.id, name: d.name, code: d.code || ''})}
                    aria-label={L('Επεξεργασία', 'Edit')}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              ),
            )}
          </div>
        </section>
      )}
    </>
  );
}
