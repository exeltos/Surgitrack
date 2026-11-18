import {useLibraries} from '../../core/LibraryStore';
import {trData} from '../../i18n';

/**
 * Whether the patient code is required with a dispatch to Sterilization, and in which departments: a switch, and
 * when it is on, the departments to tick. Limited-use instruments and counted Sets ask for it anyway.
 */
export default function PatientCodeSetting({L, actor}: {L: (el: string, en: string) => string; actor: string}) {
  const libs = useLibraries();
  const {patientCodeRequired = false, patientCodeDepartments = []} = libs.systemSettings;
  // Sterilization receives, it does not send: it is left out of the list.
  const departments = libs.departments
    .filter(item => item.active !== false && item.el !== 'Κεντρική Αποστείρωση')
    .map(item => item.el);
  const toggle = (name: string) =>
    libs.updateSystemSettings(
      {
        patientCodeDepartments: patientCodeDepartments.includes(name)
          ? patientCodeDepartments.filter(item => item !== name)
          : [...patientCodeDepartments, name],
      },
      actor,
    );
  return (
    <>
      <label>
        {L('Κωδικός ασθενούς στην αποστολή', 'Patient code with a dispatch')}
        <div className="studio-setting-input studio-setting-switch">
          <input
            type="checkbox"
            role="switch"
            checked={patientCodeRequired}
            onChange={e => libs.updateSystemSettings({patientCodeRequired: e.target.checked}, actor)}
          />
          <span aria-hidden="true"></span>
          <b>{patientCodeRequired ? L('Υποχρεωτικός', 'Required') : L('Προαιρετικός', 'Optional')}</b>
        </div>
        <small>
          {patientCodeRequired
            ? L(
                'Υποχρεωτικός στα τμήματα που επιλέγετε· στα υπόλοιπα μένει προαιρετικός. Μόνο κωδικός, όχι ονοματεπώνυμο.',
                'Required in the departments you choose; optional in the rest. A code only, never a name.',
              )
            : L(
                'Προαιρετικός σε όλα τα τμήματα. Τα εργαλεία περιορισμένων χρήσεων και τα Σετ με καταμέτρηση τον ζητούν πάντα.',
                'Optional in every department. Limited-use instruments and counted Sets always ask for it.',
              )}
        </small>
      </label>
      {patientCodeRequired && (
        <fieldset className="patient-code-departments">
          <legend>{L('Υποχρεωτικός για τα τμήματα', 'Required for the departments')}</legend>
          {departments.map(name => (
            <label key={name}>
              <input type="checkbox" checked={patientCodeDepartments.includes(name)} onChange={() => toggle(name)} />
              {trData(name)}
            </label>
          ))}
        </fieldset>
      )}
    </>
  );
}
