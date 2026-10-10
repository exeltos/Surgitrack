import {Pencil, Plus, Save, X} from 'lucide-react';
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
    saveDepartment,
    setEditing,
    setNewDepartment,
    tab,
    toggleDepartment,
  } = s;
  const {sets} = useSurgi();
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
                  'Εμφανίζονται στη φόρμα εγγραφής, στα Σετ, στα εργαλεία και στην ιχνηλάτηση. Το τμήμα της Αποστείρωσης έχει κωδικό STER.',
                  'Shown on the signup form, on Sets, instruments and traceability. The Sterilization department has the code STER.',
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
