import {useEffect} from 'react';
import {modulesOf} from '../../../core/hospitalModules';
import type {UserRole} from '../../../store/types';
import {supabase} from '../../../lib/supabase';
import {loadProfileContacts} from '../../../data/cloud/profileContacts';
import type {useStudioState} from './useStudioState';

export function useStudioCloud(p: ReturnType<typeof useStudioState>) {
  const {
    cloudOrganizations,
    cloudUsers,
    libs,
    platformAdmin,
    selectedOrganizationId,
    setCloudDepartments,
    setCloudError,
    setCloudOrganizations,
    setCloudUsers,
  } = p;

  const loadCloudOrganizations = async () => {
    if (libs.dataMode !== 'PRODUCTION') return;
    // Demo hospitals are sandboxes, not customers: they are managed through the Demo buttons only.
    const {data, error} = await supabase
      .from('organizations')
      .select('id,name,code,active,demo_enabled,plan,trial_ends_at,modules')
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
          modules: modulesOf(row.modules),
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
      .select('id,name,role,active,demo_enabled,organization_id,department_id')
      .not('organization_id', 'is', null)
      .order('name');
    // Sign-in emails are read through profile_contacts(): the platform owner gets everyone's.
    const {contacts} = await loadProfileContacts();
    if (error) {
      setCloudError(error.message);
      return;
    }
    setCloudUsers(
      (data || []).map(row => ({
        id: row.id,
        name: row.name,
        email: contacts.get(row.id)?.email ?? '',
        role: row.role as UserRole,
        active: row.active,
        demoEnabled: row.demo_enabled,
        organizationId: row.organization_id || '',
        department: row.department_id || '',
      })),
    );
  };
  useEffect(() => {
    // A hospital admin reads only their own hospital's profiles (RLS): the role counts need them too.
    void loadCloudUsers();
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
  return {
    displayedOrganizations,
    displayedUsers,
    loadCloudDepartments,
    loadCloudOrganizations,
    loadCloudUsers,
    selectedOrganization,
  };
}
