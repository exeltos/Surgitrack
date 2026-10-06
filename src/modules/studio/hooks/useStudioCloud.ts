import {useEffect} from 'react';
import type {LibraryItem} from '../../../core/libraries';
import type {UserRole} from '../../../store/types';
import {supabase} from '../../../lib/supabase';
import type {useStudioState} from './useStudioState';

export function useStudioCloud(p: ReturnType<typeof useStudioState>) {
  const {
    L,
    cloudOrganizations,
    cloudUsers,
    libs,
    platformAdmin,
    selectedOrganizationId,
    setCloudDepartments,
    setCloudError,
    setCloudOrganizations,
    setCloudUsers,
    setNewItem,
  } = p;

  const loadCloudOrganizations = async () => {
    if (libs.dataMode !== 'PRODUCTION') return;
    // Demo hospitals are sandboxes, not customers: they are managed through the Demo buttons only.
    const {data, error} = await supabase
      .from('organizations')
      .select('id,name,code,active,demo_enabled,plan,trial_ends_at')
      .eq('is_demo', false)
      .order('name');
    if (error) setCloudError(error.message);
    else {
      setCloudError('');
      setCloudOrganizations(
        (data || []).map(row => ({
          id: row.id,
          name: row.name,
          code: row.code,
          active: row.active,
          demoEnabled: row.demo_enabled,
          plan: row.plan === 'TRIAL' ? 'TRIAL' : 'STANDARD',
          trialEndsAt: row.trial_ends_at || undefined,
        })),
      );
    }
  };
  useEffect(() => {
    if (platformAdmin) void loadCloudOrganizations();
    // Reload when the data mode changes, not on every render of the loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libs.dataMode]);
  const displayedOrganizations = libs.dataMode === 'PRODUCTION' ? cloudOrganizations : libs.organizations;
  const loadCloudUsers = async () => {
    if (libs.dataMode !== 'PRODUCTION') return;
    const {data, error} = await supabase
      .from('profiles')
      .select('id,name,email,role,active,demo_enabled,organization_id,department_id')
      .not('organization_id', 'is', null)
      .order('name');
    if (error) {
      setCloudError(error.message);
      return;
    }
    setCloudUsers(
      (data || []).map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role as UserRole,
        active: row.active,
        demoEnabled: row.demo_enabled,
        organizationId: row.organization_id || '',
        department: row.department_id || '',
      })),
    );
  };
  useEffect(() => {
    if (platformAdmin) void loadCloudUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libs.dataMode]);
  const displayedUsers = libs.dataMode === 'PRODUCTION' ? cloudUsers : libs.users;
  const selectedOrganization = displayedOrganizations.find(o => o.id === selectedOrganizationId);
  const loadCloudDepartments = async () => {
    if (libs.dataMode !== 'PRODUCTION') return;
    const {data, error} = await supabase.rpc('platform_list_departments');
    if (error) {
      setCloudError(error.message);
      return;
    }
    setCloudDepartments(
      (data || []).map(
        (d: {id: string; organization_id: string; name: string; code: string | null; active: boolean}) => ({
          id: d.id,
          organizationId: d.organization_id,
          name: d.name,
          code: d.code || '',
          active: d.active,
        }),
      ),
    );
  };
  useEffect(() => {
    if (platformAdmin) void loadCloudDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libs.dataMode]);
  const saveCloudDepartment = async (item: Omit<LibraryItem, 'id'>) => {
    const org = selectedOrganization || displayedOrganizations[0];
    if (!org) {
      setCloudError(L('Δημιουργήστε πρώτα νοσοκομείο.', 'Create a hospital first.'));
      return;
    }
    const {error} = await supabase.rpc('platform_create_department', {
      p_organization_id: org.id,
      p_name: item.el,
      p_code: item.code || item.el.slice(0, 8),
    });
    if (error) {
      setCloudError(error.message);
      return;
    }
    setNewItem(false);
    await loadCloudDepartments();
  };
  return {
    displayedOrganizations,
    displayedUsers,
    loadCloudDepartments,
    loadCloudOrganizations,
    loadCloudUsers,
    saveCloudDepartment,
    selectedOrganization,
  };
}
