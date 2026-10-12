import {setRuntimeDataMode} from '../../config/dataMode';
import {applyDemoSessionUser, demoSessionUser, type DemoView, type HospitalRoleKind} from '../../config/demoRoles';
import {departments as defaultDepartments} from '../../core/libraries';
import {supabase} from '../../lib/supabase';

/**
 * The platform owner enters a Demo as one of its roles: the built-in SurgiTrack Demo, or (with a source) that
 * hospital's private demo copy. Each is its own demo hospital in Supabase, so demo data never mixes with real
 * hospitals. Reloads on its Overview; returns the error when the Demo could not be opened.
 */
export async function enterPlatformDemo(
  kind: HospitalRoleKind = 'ADMIN',
  sourceOrganizationId?: string,
): Promise<string | undefined> {
  const {data: demoOrganizationId, error} = await supabase.rpc('platform_ensure_demo_organization', {
    p_source: sourceOrganizationId ?? null,
  });
  if (error || !demoOrganizationId) return error?.message || '';
  const view: DemoView = kind === 'DEPARTMENT' ? 'DEPARTMENT:' : kind;
  applyDemoSessionUser(demoSessionUser(view, defaultDepartments));
  sessionStorage.setItem('surgitrack-active-organization', String(demoOrganizationId));
  setRuntimeDataMode('DEMO');
  // Each role opens on its menu's home (the Overview when its menu has it), like after signing in.
  window.location.hash = '#/';
  window.location.reload();
  return undefined;
}
