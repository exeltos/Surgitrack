import {supabase} from '../../../lib/supabase';
import {wholeHospital} from '../hospitalPeopleMeta';
import type {Department} from '../hospitalPeopleMeta';
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
  const saveDepartment = async () => {
    if (!editing?.name.trim()) return;
    if (demo) {
      libs.updateItem('departments', editing.id, {
        el: editing.name.trim(),
        code: editing.code.trim().toUpperCase() || undefined,
      });
      setEditing(null);
      return;
    }
    const {error} = await supabase
      .from('departments')
      .update({name: editing.name.trim(), code: editing.code.trim().toUpperCase() || null})
      .eq('id', editing.id);
    if (!fail(error)) {
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
  return {addDepartment, departmentLabel, saveDepartment, toggleDepartment};
}
