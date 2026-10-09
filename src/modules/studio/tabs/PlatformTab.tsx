import {Building2, Plus, Users} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {hospitalRoleKinds, hospitalRoleNames} from '../../../config/demoRoles';
import {trialEndAfter, trialEnded} from '../../../core/trial';
import PlanBadge from '../PlanBadge';
import DemoAccountsPanel from '../demo/DemoAccountsPanel';
import type {StudioPageState} from '../useStudioPage';

export default function PlatformTab({s}: {s: StudioPageState}) {
  const {
    L,
    changePlan,
    cloudDepartments,
    displayedOrganizations,
    displayedUsers,
    enterBuiltInDemo,
    enterOrganizationDemo,
    libs,
    openOrganization,
    platformAdmin,
    resetBuiltInDemo,
    setConfirm,
    setOrganizationEditor,
    tab,
    updateOrganizationFlags,
  } = s;
  return (
    <>
      {tab === 'PLATFORM' && platformAdmin && (
        <section className="studio-manager-panel studio-platform-panel">
          <header className="studio-panel-head">
            <div>
              <span className="eyebrow">{L('ΝΟΣΟΚΟΜΕΙΑ', 'HOSPITALS')}</span>
              <h2>{L('Νοσοκομεία & πρόσβαση Demo', 'Hospitals & Demo access')}</h2>
              <p>
                {L(
                  'Διαχείριση πραγματικών οργανισμών και απομονωμένης πρόσβασης Demo.',
                  'Manage real organizations and isolated Demo access.',
                )}
              </p>
            </div>
            <AppButton variant="primary" onClick={() => setOrganizationEditor(null)}>
              <Plus size={16} />
              {L('Νέο νοσοκομείο', 'New hospital')}
            </AppButton>
          </header>
          <div className="platform-kpis">
            <div>
              <span>{L('Νοσοκομεία', 'Hospitals')}</span>
              <strong>{displayedOrganizations.length}</strong>
            </div>
            <div>
              <span>{L('Ενεργά', 'Active')}</span>
              <strong>{displayedOrganizations.filter(org => org.active).length}</strong>
            </div>
            <div>
              <span>{L('Demo ενεργό', 'Demo enabled')}</span>
              <strong>{displayedOrganizations.filter(org => org.demoEnabled).length}</strong>
            </div>
            <div>
              <span>{L('Σύνολο χρηστών', 'Total users')}</span>
              <strong>{displayedUsers.length}</strong>
            </div>
          </div>
          <section className="platform-private-demo">
            <div>
              <span className="eyebrow">{L('ΙΔΙΩΤΙΚΟ DEMO', 'PRIVATE DEMO')}</span>
              <strong>
                {L('Περιβάλλον πρακτικής με δοκιμαστικά δεδομένα', 'Practice environment with sample data')}
              </strong>
              <small>
                {L(
                  'Ξεχωριστό Demo νοσοκομείο: ό,τι κάνετε αποθηκεύεται και παραμένει, χωρίς να αναμιγνύεται με τα πραγματικά νοσοκομεία. Στο header επιλέγετε ρόλο ή τμήμα.',
                  'A separate Demo hospital: everything you do is saved and kept, without mixing with real hospitals. Pick a role or department in the header.',
                )}
              </small>
            </div>
            <div className="platform-private-demo-actions">
              <span className="platform-demo-as">{L('Είσοδος στο Demo ως:', 'Enter the Demo as:')}</span>
              {hospitalRoleKinds.map(kind => (
                <button key={kind} onClick={() => enterBuiltInDemo(kind)}>
                  {L(hospitalRoleNames[kind].el, hospitalRoleNames[kind].en)}
                </button>
              ))}
              <button
                className="platform-demo-reset"
                onClick={() =>
                  setConfirm({
                    title: L('Επαναφορά Demo', 'Reset Demo'),
                    message: L(
                      'Θα διαγραφούν όλα τα δεδομένα του SurgiTrack Demo και θα ξαναφορτωθούν τα αρχικά δοκιμαστικά. Τα πραγματικά νοσοκομεία δεν επηρεάζονται.',
                      'All SurgiTrack Demo data will be deleted and the original sample data reloaded. Real hospitals are not affected.',
                    ),
                    action: () => void resetBuiltInDemo(),
                  })
                }
              >
                {L('Επαναφορά Demo', 'Reset Demo')}
              </button>
            </div>
          </section>
          {libs.dataMode === 'PRODUCTION' && <DemoAccountsPanel />}
          <div className="platform-org-list">
            {displayedOrganizations.map(org => {
              const orgUsers = displayedUsers.filter(user => user.organizationId === org.id);
              const demoUsers = orgUsers.filter(user => user.demoEnabled).length;
              return (
                <article className="platform-org-card" key={org.id}>
                  <div className="platform-org-main">
                    <div className="platform-org-icon">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <strong>{org.name}</strong>
                      <small>
                        {org.code} · {orgUsers.length} {L('χρήστες', 'users')}
                      </small>
                      <PlanBadge org={org} L={L} />
                    </div>
                  </div>
                  <div className="platform-org-status">
                    <button
                      className={`studio-access-toggle ${org.active ? 'active' : ''}`}
                      onClick={() => void updateOrganizationFlags(org, {active: !org.active})}
                    >
                      <span></span>
                      {org.active ? L('Ενεργό', 'Active') : L('Ανενεργό', 'Inactive')}
                    </button>
                    <button
                      className={`studio-access-toggle demo ${org.demoEnabled ? 'active' : ''}`}
                      onClick={() => void updateOrganizationFlags(org, {demoEnabled: !org.demoEnabled})}
                    >
                      <span></span>
                      {org.demoEnabled ? L('Demo ανοικτό', 'Demo open') : L('Demo κλειστό', 'Demo closed')}
                    </button>
                  </div>
                  {org.plan === 'TRIAL' && (
                    <div className="platform-trial-actions">
                      <button
                        onClick={() =>
                          void changePlan(
                            org,
                            'TRIAL',
                            trialEndAfter(
                              30,
                              trialEnded(org.plan, org.trialEndsAt) || !org.trialEndsAt
                                ? new Date()
                                : new Date(org.trialEndsAt),
                            ),
                          )
                        }
                      >
                        {L('+30 ημέρες δοκιμής', '+30 trial days')}
                      </button>
                      <button className="primary" onClick={() => void changePlan(org, 'STANDARD')}>
                        {L('Κανονική χρήση', 'Standard use')}
                      </button>
                    </div>
                  )}
                  <div className="platform-demo-actions">
                    <span>{L('Είσοδος Demo ως:', 'Enter Demo as:')}</span>
                    {hospitalRoleKinds.map(kind => (
                      <button
                        key={kind}
                        disabled={!org.active || !org.demoEnabled}
                        onClick={() => enterOrganizationDemo(org, kind)}
                      >
                        {L(hospitalRoleNames[kind].el, hospitalRoleNames[kind].en)}
                      </button>
                    ))}
                  </div>
                  <div className="platform-org-meta">
                    <span>
                      {L('Τμήματα', 'Departments')}:{' '}
                      <b>{cloudDepartments.filter(d => d.organizationId === org.id).length}</b> ·{' '}
                      {L('Demo χρήστες', 'Demo users')}: <b>{demoUsers}</b>
                    </span>
                    <button className="platform-manage-btn" onClick={() => openOrganization(org)}>
                      <Users size={15} />
                      <span>{L('Διαχείριση', 'Manage')}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {!displayedOrganizations.length && (
            <div className="studio-empty">{L('Δεν υπάρχουν νοσοκομεία.', 'No hospitals yet.')}</div>
          )}
        </section>
      )}
    </>
  );
}
