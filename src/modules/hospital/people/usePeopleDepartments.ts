import {supabase} from '../../../lib/supabase';
import {wholeHospital} from '../hospitalPeopleMeta';
import type {Department} from '../hospitalPeopleMeta';
import {renameExemptDepartment} from '../../../core/handoverPolicy';
import {managedHospitalId} from '../../../data/cloud/accessRequests';
import type {usePeopleState} from './usePeopleState';
import type {usePeopleData} from './usePeopleData';
import type {usePeopleView} from './usePeopleView';
import type {usePeopleDecisions} from './usePeopleDecisions';

export function usePeopleDepartments(
  p: ReturnType<typeof usePeopleState> &
    ReturnType<typeof usePeopleData> &
    ReturnType<typeof usePeopleView> &
    ReturnType<typeof usePeopleDecisions>,
) {
  const {changed, demo, departments, editing, fail, libs, newDepartment, organizationId, setEditing, setNewDepartment} =
    p;

  // The hospital's own settings (receipt exemptions, which departments count, the patient code) are those of the
  // hospital the app is working in: the platform owner looking at another hospital's departments from Studio does
  // not change them (they would land on the hospital open, under another hospital's department names).
  const ownHospital = demo || (!!organizationId && organizationId === managedHospitalId());

  // ---- Departments ----
  const addDepartment = async () => {
    const name = newDepartment.name.trim();
    if (!name) return;
    if (demo) {
      libs.addItem('departments', {el: name, en: name, code: newDepartment.code.trim().toUpperCase() || undefined});
      setNewDepartment({name: '', code: ''});
      return;
    }
    const {error} = await supabase.from('departments').insert({
      organization_id: organizationId,
      name,
      code: newDepartment.code.trim().toUpperCase() || null,
    });
    if (!fail(error)) {
      setNewDepartment({name: '', code: ''});
      await changed();
    }
  };
  // A renamed department keeps what it was set to do (they are kept by name): its exemptions from the department
  // check, its instrument count and its required patient code.
  const carryExemptions = (id: string, to: string) => {
    const from = departments.find(d => d.id === id)?.name;
    if (!ownHospital || !from || from === to) return;
    const policy = libs.sterilizationWorkflow.receiptPolicy;
    if (policy) {
      const renamed = renameExemptDepartment(policy, from, to);
      if (renamed !== policy) libs.updateSterilizationWorkflow({receiptPolicy: renamed});
    }
    const rename = (list?: string[]) =>
      list?.includes(from) ? list.map(name => (name === from ? to : name)) : undefined;
    const counting = rename(libs.systemSettings.surgicalCountDepartments);
    const patientCode = rename(libs.systemSettings.patientCodeDepartments);
    if (counting || patientCode)
      libs.updateSystemSettings({
        ...(counting ? {surgicalCountDepartments: counting} : {}),
        ...(patientCode ? {patientCodeDepartments: patientCode} : {}),
      });
  };
  const saveDepartment = async () => {
    if (!editing?.name.trim()) return;
    if (demo) {
      libs.updateItem('departments', editing.id, {
        el: editing.name.trim(),
        code: editing.code.trim().toUpperCase() || undefined,
      });
      carryExemptions(editing.id, editing.name.trim());
      setEditing(null);
      return;
    }
    const {error} = await supabase
      .from('departments')
      .update({name: editing.name.trim(), code: editing.code.trim().toUpperCase() || null})
      .eq('id', editing.id);
    if (!fail(error)) {
      carryExemptions(editing.id, editing.name.trim());
      setEditing(null);
      await changed();
    }
  };
  const toggleDepartment = async (d: Department) => {
    if (demo) {
      libs.updateItem('departments', d.id, {active: !d.active});
      return;
    }
    const {error} = await supabase.from('departments').update({active: !d.active}).eq('id', d.id);
    if (!fail(error)) await changed();
  };

  // ---- Users ----
  const departmentLabel = (role: string, departmentId: string) =>
    wholeHospital(role) ? '' : departments.find(d => d.id === departmentId)?.name || '';
  return {
    ownHospital,
    addDepartment,
    departmentLabel,
    saveDepartment,
    toggleDepartment,
  };
}
