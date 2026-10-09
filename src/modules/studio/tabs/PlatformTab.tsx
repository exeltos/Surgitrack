import {useState} from 'react';
import {
  Building2,
  CalendarPlus,
  CheckCircle2,
  FlaskConical,
  LogIn,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Trash2,
  Users,
} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import ActionMenu, {type ActionMenuItem} from '../../../components/ui/ActionMenu';
import {hospitalRoleKinds, hospitalRoleNames, type HospitalRoleKind} from '../../../config/demoRoles';
import type {Organization} from '../../../core/LibraryStore';
import {trialEndAfter, trialEnded} from '../../../core/trial';
import PlanBadge from '../PlanBadge';
import DemoAccountsPanel from '../demo/DemoAccountsPanel';
import type {StudioPageState} from '../useStudioPage';

type View = 'HOSPITALS' | 'EVALUATION' | 'PRIVATE';
const VIEW_KEY = 'surgitrack-platform-view';
const readView = (): View => {
  try {
    const saved = sessionStorage.getItem(VIEW_KEY);
    return saved === 'EVALUATION' || saved === 'PRIVATE' ? saved : 'HOSPITALS';
  } catch {
    return 'HOSPITALS';
  }
};

export default function PlatformTab({s}: {s: StudioPageState}) {
  const {L, displayedOrganizations, displayedUsers, libs, platformAdmin, setOrganizationEditor, tab} = s;
  const [view, setViewState] = useState<View>(readView);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const cloud = libs.dataMode === 'PRODUCTION';
  const setView = (next: View) => {
    setViewState(next);
    try {
      sessionStorage.setItem(VIEW_KEY, next);
    } catch {
      // Without storage the view simply opens on Hospitals next time.
    }
  };
  if (tab !== 'PLATFORM' || !platformAdmin) return null;
  const trials = displayedOrganizations.filter(org => org.plan === 'TRIAL');
  const views: Array<{id: View; label: string; count?: number}> = [
    {id: 'HOSPITALS', label: L('Νοσοκομεία', 'Hospitals'), count: displayedOrganizations.length},
    ...(cloud ? [{id: 'EVALUATION' as const, label: L('Demo αξιολόγησης', 'Evaluation Demos')}] : []),
    {id: 'PRIVATE', label: L('Δικό μου Demo', 'My Demo')},
  ];
  const current = !cloud && view === 'EVALUATION' ? 'HOSPITALS' : view;
  return (
    <section className="studio-manager-panel studio-platform-panel">
      <header className="studio-panel-head">
        <div>
          <span className="eyebrow">{L('ΠΛΑΤΦΟΡΜΑ', 'PLATFORM')}</span>
          <h2>{L('Νοσοκομεία & Demo', 'Hospitals & Demo')}</h2>
          <p>
            {L(
              'Οι πελάτες της πλατφόρμας, τα Demo των υποψήφιων πελατών και το δικό σας περιβάλλον πρακτικής.',
              'The platform’s customers, the prospects’ Demos and your own practice environment.',
            )}
          </p>
        </div>
        <div className="platform-head-actions">
          {cloud && (
            <AppButton
              onClick={() => {
                setView('EVALUATION');
                setCreatingDemo(true);
              }}
            >
              <FlaskConical size={16} />
              {L('Νέο Demo αξιολόγησης', 'New evaluation Demo')}
            </AppButton>
          )}
          <AppButton variant="primary" onClick={() => setOrganizationEditor(null)}>
            <Plus size={16} />
            {L('Νέο νοσοκομείο', 'New hospital')}
          </AppButton>
        </div>
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
          <span>{L('Σε δοκιμαστική περίοδο', 'On trial')}</span>
          <strong>{trials.filter(org => !trialEnded(org.plan, org.trialEndsAt)).length}</strong>
        </div>
        <div>
          <span>{L('Χρήστες νοσοκομείων', 'Hospital users')}</span>
          <strong>{displayedUsers.length}</strong>
        </div>
      </div>
      <nav className="platform-views" aria-label={L('Ενότητες', 'Sections')}>
        {views.map(v => (
          <button
            key={v.id}
            className={current === v.id ? 'active' : ''}
            aria-pressed={current === v.id}
            onClick={() => setView(v.id)}
          >
            {v.label}
            {v.count !== undefined && <b>{v.count}</b>}
          </button>
        ))}
      </nav>
      {current === 'HOSPITALS' && <HospitalList s={s} />}
      {current === 'EVALUATION' && <DemoAccountsPanel creating={creatingDemo} onCreatingChange={setCreatingDemo} />}
      {current === 'PRIVATE' && <PrivateDemo s={s} />}
    </section>
  );
}

function HospitalList({s}: {s: StudioPageState}) {
  const {L, changePlan, cloudDepartments, displayedOrganizations, displayedUsers, openOrganization} = s;
  if (!displayedOrganizations.length)
    return <div className="studio-empty">{L('Δεν υπάρχουν νοσοκομεία.', 'No hospitals yet.')}</div>;
  return (
    <div className="platform-hospitals" role="list">
      {displayedOrganizations.map(org => {
        const users = displayedUsers.filter(user => user.organizationId === org.id).length;
        const departments = cloudDepartments.filter(d => d.organizationId === org.id).length;
        return (
          <article className={`platform-hospital ${org.active ? '' : 'inactive'}`} key={org.id} role="listitem">
            <div className="platform-hospital-icon">
              <Building2 size={18} />
            </div>
            <div className="platform-hospital-name">
              <strong>{org.name}</strong>
              <small>
                {org.code} · {users} {L('χρήστες', 'users')} · {departments} {L('τμήματα', 'departments')}
              </small>
            </div>
            <div className="platform-hospital-badges">
              <PlanBadge org={org} L={L} />
              <span className={`platform-status ${org.active ? 'on' : 'off'}`}>
                {org.active ? L('Ενεργό', 'Active') : L('Ανενεργό', 'Inactive')}
              </span>
              {org.demoEnabled && <span className="platform-status demo">{L('Demo ανοικτό', 'Demo open')}</span>}
            </div>
            <div className="platform-hospital-actions">
              {org.plan === 'TRIAL' && (
                <button
                  className="platform-quick"
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
                  <CalendarPlus size={14} />
                  {L('+30 ημέρες', '+30 days')}
                </button>
              )}
              <AppButton onClick={() => openOrganization(org)}>
                <Users size={15} />
                {L('Διαχείριση', 'Manage')}
              </AppButton>
              <ActionMenu
                icon={<MoreHorizontal size={15} />}
                label={L('Ενέργειες', 'Actions')}
                align="right"
                items={hospitalActions(s, org)}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** Everything else a hospital's row can do, behind one menu instead of a row of buttons. */
function hospitalActions(s: StudioPageState, org: Organization): ActionMenuItem[] {
  const {
    L,
    changePlan,
    deleteOrganization,
    enterOrganizationDemo,
    libs,
    setConfirm,
    setOrganizationEditor,
    updateOrganizationFlags,
  } = s;
  const items: ActionMenuItem[] = [
    {
      key: 'edit',
      icon: <Pencil size={15} />,
      label: L('Επεξεργασία', 'Edit'),
      hint: L('Όνομα, κωδικός, χρήση και λήξη', 'Name, code, use and end date'),
      onSelect: () => setOrganizationEditor(org),
    },
  ];
  if (org.plan === 'TRIAL')
    items.push({
      key: 'standard',
      icon: <CheckCircle2 size={15} />,
      label: L('Μετατροπή σε κανονική χρήση', 'Switch to standard use'),
      hint: L('Χωρίς λήξη', 'No end date'),
      onSelect: () =>
        setConfirm({
          title: L('Κανονική χρήση', 'Standard use'),
          message: L(
            `Το «${org.name}» θα περάσει σε κανονική χρήση, χωρίς λήξη. Μπορείτε να το επαναφέρετε σε δοκιμαστική περίοδο από την «Επεξεργασία».`,
            `“${org.name}” will switch to standard use, with no end date. You can put it back on a trial from «Edit».`,
          ),
          action: () => void changePlan(org, 'STANDARD'),
        }),
    });
  items.push(
    {
      key: 'active',
      icon: <Power size={15} />,
      label: org.active ? L('Απενεργοποίηση', 'Deactivate') : L('Ενεργοποίηση', 'Activate'),
      hint: org.active
        ? L('Οι χρήστες του δεν μπαίνουν', 'Its users cannot sign in')
        : L('Οι χρήστες του μπαίνουν ξανά', 'Its users can sign in again'),
      danger: org.active,
      onSelect: () =>
        org.active
          ? setConfirm({
              title: L('Απενεργοποίηση νοσοκομείου', 'Deactivate hospital'),
              message: L(
                `Οι χρήστες του «${org.name}» δεν θα μπορούν να εργαστούν μέχρι να το ενεργοποιήσετε ξανά. Τα δεδομένα μένουν.`,
                `The users of “${org.name}” cannot work until you activate it again. The data stays.`,
              ),
              action: () => void updateOrganizationFlags(org, {active: false}),
            })
          : void updateOrganizationFlags(org, {active: true}),
    },
    {
      key: 'demo',
      icon: <FlaskConical size={15} />,
      label: org.demoEnabled
        ? L('Κλείσιμο ιδιωτικού Demo', 'Close private Demo')
        : L('Άνοιγμα ιδιωτικού Demo', 'Open private Demo'),
      hint: L('Αντίγραφο του νοσοκομείου για πρακτική', 'A practice copy of the hospital'),
      onSelect: () => void updateOrganizationFlags(org, {demoEnabled: !org.demoEnabled}),
    },
  );
  // Inside the Demo the header switches role or department, so one entry is enough.
  if (org.active && org.demoEnabled)
    items.push({
      key: 'demo-enter',
      icon: <LogIn size={15} />,
      label: L('Είσοδος στο ιδιωτικό Demo', 'Enter the private Demo'),
      hint: L('Ως Διαχειριστής νοσοκομείου', 'As Hospital administrator'),
      onSelect: () => enterOrganizationDemo(org, 'ADMIN'),
    });
  if (libs.dataMode === 'PRODUCTION')
    items.push({
      key: 'delete',
      icon: <Trash2 size={15} />,
      label: L('Διαγραφή νοσοκομείου', 'Delete hospital'),
      hint: L('Οριστικά, με όλα τα δεδομένα και τους χρήστες', 'For good, with all its data and users'),
      danger: true,
      onSelect: () =>
        setConfirm({
          title: L('Διαγραφή νοσοκομείου', 'Delete hospital'),
          message: L(
            `Το «${org.name}» θα διαγραφεί οριστικά: όλες οι εγγραφές του (Σετ, εργαλεία, κύκλοι, διακινήσεις, ιστορικό), τα τμήματα, το ιδιωτικό Demo του και οι λογαριασμοί όλων των χρηστών του. Δεν αναιρείται.`,
            `“${org.name}” will be deleted for good: all its records (Sets, instruments, cycles, movements, history), its departments, its private Demo and the accounts of all its users. This cannot be undone.`,
          ),
          confirmLabel: L('Οριστική διαγραφή', 'Delete for good'),
          danger: true,
          confirmText: org.name,
          action: () => void deleteOrganization(org),
        }),
    });
  return items;
}

/** The owner's own practice hospital: pick a role and enter, or reset it. */
function PrivateDemo({s}: {s: StudioPageState}) {
  const {L, enterBuiltInDemo, resetBuiltInDemo, setConfirm} = s;
  const [kind, setKind] = useState<HospitalRoleKind>('ADMIN');
  return (
    <section className="platform-private-demo">
      <div>
        <span className="eyebrow">{L('ΔΙΚΟ ΜΟΥ DEMO', 'MY DEMO')}</span>
        <strong>{L('Περιβάλλον πρακτικής με δοκιμαστικά δεδομένα', 'Practice environment with sample data')}</strong>
        <small>
          {L(
            'Ξεχωριστό Demo νοσοκομείο μόνο για εσάς: ό,τι κάνετε μένει, χωρίς να αναμιγνύεται με τα πραγματικά νοσοκομεία. Μέσα, στο header αλλάζετε ρόλο ή τμήμα.',
            'A separate Demo hospital for you only: everything you do stays, without mixing with real hospitals. Inside, change role or department in the header.',
          )}
        </small>
      </div>
      <div className="platform-private-demo-actions">
        <label>
          <span>{L('Είσοδος ως', 'Enter as')}</span>
          <select value={kind} onChange={e => setKind(e.target.value as HospitalRoleKind)}>
            {hospitalRoleKinds.map(k => (
              <option key={k} value={k}>
                {L(hospitalRoleNames[k].el, hospitalRoleNames[k].en)}
              </option>
            ))}
          </select>
        </label>
        <AppButton variant="primary" onClick={() => enterBuiltInDemo(kind)}>
          <LogIn size={15} />
          {L('Είσοδος', 'Enter')}
        </AppButton>
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
          <RotateCcw size={14} />
          {L('Επαναφορά', 'Reset')}
        </button>
      </div>
    </section>
  );
}
