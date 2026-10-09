import {setRuntimeDataMode} from '../../../config/dataMode';
import {type Organization} from '../../../core/LibraryStore';
import type {UserRole} from '../../../store/types';
import {supabase} from '../../../lib/supabase';
import {applyDemoSessionUser, demoSessionUser, type DemoView, type HospitalRoleKind} from '../../../config/demoRoles';
import {departments as defaultDepartments} from '../../../core/libraries';
import {organizationCode} from '../../../core/organizationCode';
import type {useStudioState} from './useStudioState';
import type {useStudioCloud} from './useStudioCloud';
import {tellUser} from '../../../components/ui/confirmService';

export function useStudioOrganizations(p: ReturnType<typeof useStudioState> & ReturnType<typeof useStudioCloud>) {
  const {
    L,
    currentUser,
    libs,
    loadCloudOrganizations,
    loadCloudUsers,
    organizationEditor,
    setCloudError,
    setOrganizationEditor,
    setQuery,
    setRole,
    selectedOrganizationId,
    setSelectedOrganizationId,
    setTab,
  } = p;

  const saveOrganization = async (data: Omit<Organization, 'id'>, hospitalAdmin?: {name: string; email: string}) => {
    if (libs.dataMode === 'DEMO') {
      if (organizationEditor) libs.updateOrganization(organizationEditor.id, data);
      else libs.addOrganization(data);
      setOrganizationEditor(undefined);
      return;
    }
    let id = organizationEditor?.id;
    if (organizationEditor) {
      const {error} = await supabase.rpc('platform_update_organization', {
        p_id: organizationEditor.id,
        p_name: data.name,
        p_code: data.code,
        p_active: data.active,
        p_demo_enabled: data.demoEnabled,
      });
      if (error) return setCloudError(error.message);
    } else {
      // The code is made from the name; on the rare clash with an existing code, another is tried.
      let created: unknown;
      let error: {code?: string; message: string} | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        ({data: created, error} = await supabase.rpc('platform_create_organization', {
          p_name: data.name,
          p_code: data.code || organizationCode(data.name),
        }));
        if (error?.code !== '23505' || data.code) break;
      }
      if (error || !created) return setCloudError(error?.message || 'create failed');
      id = String(created);
      // The create call takes only the name and code; the editor's Active and Demo choices follow.
      if (!data.active || data.demoEnabled)
        await updateOrganizationFlags({id, ...data}, {active: data.active, demoEnabled: data.demoEnabled});
    }
    const plan = await setOrganizationPlan(id!, data.plan || 'STANDARD', data.trialEndsAt);
    if (!plan) return;
    // The hospital's admin gets one email with their username and a button to accept and set a password.
    if (hospitalAdmin?.email) {
      const {data: result, error} = await supabase.functions.invoke('invite-staff', {
        body: {
          users: [
            {
              full_name: hospitalAdmin.name,
              email: hospitalAdmin.email,
              organization_id: id,
              department_id: null,
              role: 'ADMIN',
              // A new hospital's admin gets their account at once (no one there to approve them).
              direct: true,
            },
          ],
          redirect_to: window.location.origin,
        },
      });
      if (error || !result?.results?.[0]?.ok)
        setCloudError(
          L(
            'Το νοσοκομείο δημιουργήθηκε, αλλά η πρόσκληση του Διαχειριστή απέτυχε: ',
            'The hospital was created, but the admin invitation failed: ',
          ) + (result?.results?.[0]?.error || error?.message || ''),
        );
      else {
        // The account and username exist; only the email may have failed.
        if (!result.results[0].emailed)
          setCloudError(
            L(
              'Το νοσοκομείο και ο λογαριασμός του Διαχειριστή δημιουργήθηκαν, αλλά το email δεν στάλθηκε. Ανοίξτε τον στο «Χρήστες» και πατήστε «Αντιγραφή συνδέσμου».',
              "The hospital and its admin's account were created, but the email was not sent. Open them in «Users» and press «Copy link».",
            ),
          );
        await loadCloudUsers();
      }
    }
    setOrganizationEditor(undefined);
    await loadCloudOrganizations();
  };
  /** Standard use or a trial with its end; the database locks a trial hospital once it ends. */
  const setOrganizationPlan = async (id: string, plan: 'STANDARD' | 'TRIAL', trialEndsAt?: string) => {
    const {error} = await supabase
      .from('organizations')
      .update({plan, trial_ends_at: plan === 'TRIAL' ? trialEndsAt || null : null})
      .eq('id', id);
    if (error) {
      setCloudError(error.message);
      return false;
    }
    return true;
  };
  const changePlan = async (org: Organization, plan: 'STANDARD' | 'TRIAL', trialEndsAt?: string) => {
    if (await setOrganizationPlan(org.id, plan, trialEndsAt)) await loadCloudOrganizations();
  };
  const updateOrganizationFlags = async (
    org: Organization,
    patch: Partial<Pick<Organization, 'active' | 'demoEnabled'>>,
  ) => {
    if (libs.dataMode === 'DEMO') {
      libs.updateOrganization(org.id, patch);
      return;
    }
    const next = {...org, ...patch};
    const {error} = await supabase.rpc('platform_update_organization', {
      p_id: org.id,
      p_name: org.name,
      p_code: org.code,
      p_active: next.active,
      p_demo_enabled: next.demoEnabled,
    });
    if (error) {
      setCloudError(error.message);
      return;
    }
    await loadCloudOrganizations();
  };
  /** Deletes a hospital for good, with every record and its people's accounts (the name confirms it). */
  const deleteOrganization = async (org: Organization) => {
    setCloudError('');
    const {error} = await supabase.functions.invoke('delete-hospital', {
      body: {organization_id: org.id, confirm_name: org.name},
    });
    if (error) {
      const context = (error as {context?: Response}).context;
      const body = context && typeof context.json === 'function' ? await context.json().catch(() => null) : null;
      setCloudError(body?.error || error.message);
      return;
    }
    if (selectedOrganizationId === org.id) setSelectedOrganizationId('');
    if (sessionStorage.getItem('surgitrack-active-organization') === org.id)
      sessionStorage.removeItem('surgitrack-active-organization');
    await loadCloudOrganizations();
    await loadCloudUsers();
  };
  const openOrganization = (org: Organization) => {
    setSelectedOrganizationId(org.id);
    setTab('USERS');
    setQuery('');
  };
  const handleResetSterilizationWorkflow = () => {
    libs.resetSterilizationWorkflow(currentUser.name);
  };
  // Every demo is its own demo hospital in Supabase, so demo data never mixes with real hospitals.
  // Without a source it is the built-in SurgiTrack Demo; with one, that hospital's private demo copy.
  const enterDemo = async (kind: HospitalRoleKind, sourceOrganizationId?: string) => {
    const role: UserRole = kind === 'STERILIZATION_SUPERVISOR' ? 'STERILIZATION' : kind;
    setCloudError('');
    const {data: demoOrganizationId, error} = await supabase.rpc('platform_ensure_demo_organization', {
      p_source: sourceOrganizationId ?? null,
    });
    if (error || !demoOrganizationId) {
      setCloudError(error?.message || L('Δεν ήταν δυνατή η είσοδος στο Demo.', 'Could not open the Demo.'));
      return;
    }
    const view: DemoView = kind === 'DEPARTMENT' ? 'DEPARTMENT:' : kind;
    applyDemoSessionUser(demoSessionUser(view, defaultDepartments));
    sessionStorage.setItem('surgitrack-active-organization', String(demoOrganizationId));
    setRuntimeDataMode('DEMO');
    setRole(role);
    // Each role opens on its menu's home (the Overview when its menu has it), like after signing in.
    window.location.hash = '#/';
    window.location.reload();
  };
  const enterBuiltInDemo = (kind: HospitalRoleKind) => void enterDemo(kind);
  const enterOrganizationDemo = (organization: Organization, kind: HospitalRoleKind) => {
    if (!organization.active || !organization.demoEnabled) return;
    void enterDemo(kind, organization.id);
  };
  const resetBuiltInDemo = async () => {
    const {data: demoOrganizationId, error} = await supabase.rpc('platform_ensure_demo_organization', {
      p_source: null,
    });
    const {error: resetError} = error
      ? {error}
      : await supabase.rpc('platform_reset_demo_organization', {p_org: demoOrganizationId});
    setCloudError(resetError ? resetError.message : '');
    if (!resetError)
      void tellUser(
        L('Το Demo επανήλθε', 'The Demo was reset'),
        L(
          'Την επόμενη φορά που θα μπείτε θα έχει ξανά τα αρχικά δοκιμαστικά δεδομένα.',
          'Next time you enter it will have the original sample data again.',
        ),
      );
  };
  return {
    changePlan,
    deleteOrganization,
    enterBuiltInDemo,
    enterOrganizationDemo,
    handleResetSterilizationWorkflow,
    openOrganization,
    resetBuiltInDemo,
    saveOrganization,
    updateOrganizationFlags,
  };
}
