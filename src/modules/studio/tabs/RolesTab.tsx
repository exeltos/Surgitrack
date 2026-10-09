import {useUnsavedChanges} from '../../../app/UnsavedChanges';
import {RefreshCcw, ShieldCheck, Users, CheckCircle2, Lock, Save} from 'lucide-react';
import {permissionCatalog, type PermissionGroup} from '../../../core/permissions';
import AppButton from '../../../components/ui/AppButton';
import {roles, permissionGroupMeta} from '../studioMeta';
import type {StudioPageState} from '../useStudioPage';
import {formatDateTime} from '../../../core/displayDate';

export default function RolesTab({s}: {s: StudioPageState}) {
  const {
    L,
    libs,
    protectedPermissionSet,
    resetSelectedRole,
    roleCount,
    roleDirty,
    roleDraft,
    saveRolePermissions,
    selectRole,
    selectedRole,
    supervisorOnlyFor,
    tab,
    toggleRolePermission,
    visiblePermissionGroups,
  } = s;
  useUnsavedChanges(roleDirty && selectedRole !== 'ADMIN');
  return (
    <>
      {tab === 'ROLES' && (
        <div className="studio-role-manager">
          <aside className="studio-role-selector">
            <div className="studio-role-selector-head">
              <span className="eyebrow">{L('ΡΟΛΟΙ', 'ROLES')}</span>
              <strong>{L('Βασικοί ρόλοι πρόσβασης', 'Core access roles')}</strong>
              <small>
                {L(
                  'Οι ρόλοι παραμένουν σταθεροί. Παραμετροποιούνται μόνο τα επιτρεπόμενα δικαιώματα.',
                  'Roles remain fixed. Only allowed permissions can be configured.',
                )}
              </small>
            </div>
            {roles.map(r => {
              const count = roleCount.find(x => x.role === r.id)?.count || 0;
              return (
                <button key={r.id} className={selectedRole === r.id ? 'active' : ''} onClick={() => selectRole(r.id)}>
                  <span className={`studio-role-icon role-${r.id.toLowerCase()}`}>
                    <ShieldCheck size={18} />
                  </span>
                  <div>
                    <b>{L(r.el, r.en)}</b>
                    <small>
                      {count} {count === 1 ? L('ενεργός χρήστης', 'active user') : L('ενεργοί χρήστες', 'active users')}
                    </small>
                  </div>
                </button>
              );
            })}
          </aside>
          <section className="studio-role-permission-panel">
            <header className="studio-role-permission-head">
              <div>
                <span className="eyebrow">{L('ΔΙΚΑΙΩΜΑΤΑ ΡΟΛΟΥ', 'ROLE PERMISSIONS')}</span>
                <h2>{L(roles.find(r => r.id === selectedRole)!.el, roles.find(r => r.id === selectedRole)!.en)}</h2>
                <p>
                  {L(
                    roles.find(r => r.id === selectedRole)!.descriptionEl,
                    roles.find(r => r.id === selectedRole)!.descriptionEn,
                  )}
                </p>
              </div>
              <div className="studio-role-head-actions">
                <span className="studio-role-user-count">
                  <Users size={15} />
                  {(n => `${n} ${n === 1 ? L('ενεργός', 'active') : L('ενεργοί', 'active')}`)(
                    roleCount.find(x => x.role === selectedRole)?.count || 0,
                  )}
                </span>
                <AppButton onClick={resetSelectedRole}>
                  <RefreshCcw size={15} />
                  {L('Επαναφορά', 'Reset')}
                </AppButton>
                <AppButton
                  variant="primary"
                  disabled={!roleDirty || selectedRole === 'ADMIN'}
                  onClick={saveRolePermissions}
                >
                  <Save size={15} />
                  {L('Αποθήκευση', 'Save')}
                </AppButton>
              </div>
            </header>
            <div className="studio-role-security-banner">
              <ShieldCheck size={18} />
              <div>
                <strong>
                  {selectedRole === 'ADMIN'
                    ? L('Πλήρης πρόσβαση διαχειριστή', 'Full administrator access')
                    : L('Προστατευμένος πυρήνας δικαιωμάτων', 'Protected permission core')}
                </strong>
                <span>
                  {selectedRole === 'ADMIN'
                    ? L(
                        'Ο Διαχειριστής διατηρεί πάντα πλήρη πρόσβαση στο SurgiTrack.',
                        'Administrator always retains full SurgiTrack access.',
                      )
                    : selectedRole === 'VIEWER'
                      ? L(
                          'Ο Παρατηρητής δεν μπορεί ποτέ να αποκτήσει δικαίωμα ενέργειας· εδώ ορίζετε μόνο ποιες ενότητες βλέπει. Οι αλλαγές δεδομένων μπλοκάρονται και στον server.',
                          'A viewer can never be given an action; here you only choose which sections they see. Data changes are also blocked on the server.',
                        )
                      : selectedRole === 'DEPARTMENT'
                        ? L(
                            'Ο ρόλος Τμήματος περιορίζεται πάντα στα assets του δηλωμένου τμήματος και δεν μπορεί να αποκτήσει δικαιώματα CSSD ή Studio.',
                            'Department role is always scoped to its assigned department and cannot gain CSSD or Studio administration permissions.',
                          )
                        : L(
                            'Τα κρίσιμα δικαιώματα chain of custody παραμένουν κλειδωμένα. Τα υπόλοιπα μπορούν να προσαρμοστούν στην πολιτική της μονάδας.',
                            'Critical chain-of-custody permissions remain locked. Other permissions can follow facility policy.',
                          )}
                </span>
              </div>
            </div>
            {selectedRole === 'ADMIN' ? (
              <div className="studio-admin-access-summary">
                <div>
                  <ShieldCheck size={20} />
                  <strong>
                    {L('Ο Διαχειριστής SurgiTrack έχει πλήρη πρόσβαση', 'SurgiTrack Administrator has full access')}
                  </strong>
                  <span>
                    {L(
                      'Ο βασικός ρόλος Διαχειριστή δεν παραμετροποιείται, ώστε να μην μπορεί να κλειδωθεί κατά λάθος η διαχείριση του συστήματος.',
                      'The core Administrator role is not configurable, preventing accidental lockout of system administration.',
                    )}
                  </span>
                </div>
                {(Object.keys(permissionGroupMeta) as PermissionGroup[]).map(group => (
                  <section key={group}>
                    <strong>{L(permissionGroupMeta[group].el, permissionGroupMeta[group].en)}</strong>
                    <span>
                      <CheckCircle2 size={15} />
                      {permissionCatalog.filter(item => item.group === group).length}{' '}
                      {L('δικαιώματα ενεργά', 'permissions active')}
                    </span>
                  </section>
                ))}
              </div>
            ) : (
              <div className="studio-permission-groups">
                {visiblePermissionGroups.map(section => (
                  <section className="studio-permission-group" key={section.group}>
                    <header>
                      <strong>{L(permissionGroupMeta[section.group].el, permissionGroupMeta[section.group].en)}</strong>
                      <span>
                        {
                          section.permissions.filter(
                            item => supervisorOnlyFor(item.key) || roleDraft.includes(item.key),
                          ).length
                        }
                        /{section.permissions.length}
                      </span>
                    </header>
                    <div>
                      {section.permissions.map(item => {
                        const supervisorOnly = supervisorOnlyFor(item.key);
                        const locked = protectedPermissionSet.has(item.key) || supervisorOnly;
                        const checked = supervisorOnly || roleDraft.includes(item.key);
                        return (
                          <label key={item.key} className={`studio-permission-toggle ${locked ? 'locked' : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={locked}
                              onChange={() => toggleRolePermission(item.key)}
                            />
                            <span className="studio-permission-check"></span>
                            <span className="studio-permission-copy">
                              <b>{L(item.el, item.en)}</b>
                              <small>{L(item.hintEl, item.hintEn)}</small>
                            </span>
                            {locked && (
                              <span className="studio-permission-lock">
                                <Lock size={13} />
                                {supervisorOnly
                                  ? L('Μόνο Προϊστάμενος', 'Supervisor only')
                                  : L('Προστατευμένο', 'Protected')}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
            <section className="studio-role-audit">
              <header>
                <div>
                  <strong>{L('Πρόσφατες αλλαγές δικαιωμάτων', 'Recent permission changes')}</strong>
                  <small>{L('Καταγραφή χρήστη και χρονικής σήμανσης.', 'User and timestamp audit trail.')}</small>
                </div>
              </header>
              {(libs.rolePermissionAudit || [])
                .filter(entry => entry.role === selectedRole)
                .slice(0, 5)
                .map(entry => (
                  <div className="studio-role-audit-row" key={entry.id}>
                    <span>{formatDateTime(entry.at)}</span>
                    <strong>{entry.by}</strong>
                    <small>
                      {entry.permissions.length} {L('δικαιώματα', 'permissions')}
                    </small>
                  </div>
                ))}
              {!(libs.rolePermissionAudit || []).some(entry => entry.role === selectedRole) && (
                <div className="studio-role-audit-empty">
                  {L(
                    'Δεν υπάρχουν ακόμη αλλαγές για αυτόν τον ρόλο.',
                    'No changes have been recorded for this role yet.',
                  )}
                </div>
              )}
            </section>
          </section>
        </div>
      )}
    </>
  );
}
