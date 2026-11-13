import {useState} from 'react';
import {
  Building2,
  CalendarPlus,
  CheckCircle2,
  FlaskConical,
  LogIn,
  MoreHorizontal,
  Network,
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
import QuickFilters from '../../../components/ui/QuickFilters';
import NetworkAccessDialog from '../NetworkAccessDialog';
import {activeHospitalId, switchHospital} from '../../../data/cloud/hospitalSwitch';
import DemoAccountsPanel from '../demo/DemoAccountsPanel';
import type {StudioPageState} from '../useStudioPage';

type DemoView = 'EVALUATION' | 'PRIVATE';
type HospitalFilter = 'ALL' | 'ACTIVE' | 'TRIAL';
const VIEW_KEY = 'surgitrack-platform-view';
const readView = (): DemoView => {
  try {
    return sessionStorage.getItem(VIEW_KEY) === 'PRIVATE' ? 'PRIVATE' : 'EVALUATION';
  } catch {
    return 'EVALUATION';
  }
};

/**
 * Two sections of the platform: «Νοσοκομεία», every customer hospital with its plan, state and «Είσοδος»
 * (one list, where the plan and the hospital list used to be two), and «Demo αξιολόγησης», the prospects'
 * Demos with sample data plus the owner's own practice Demo.
 */
export default function PlatformTab({s}: {s: StudioPageState}) {
  const {L, displayedOrganizations, libs, platformAdmin, setOrganizationEditor, tab} = s;
  const [view, setViewState] = useState<DemoView>(readView);
  const [creatingDemo, setCreatingDemo] = useState(false);
  // The figures over the hospitals filter them: all, the active ones, the ones on trial.
  const [filter, setFilter] = useState<HospitalFilter>('ALL');
  const cloud = libs.dataMode === 'PRODUCTION';
  const setView = (next: DemoView) => {
    setViewState(next);
    try {
      sessionStorage.setItem(VIEW_KEY, next);
    } catch {
      // Without storage the view simply opens on the evaluation Demos next time.
    }
  };
  if ((tab !== 'PLATFORM' && tab !== 'DEMOS') || !platformAdmin) return null;
  if (tab === 'PLATFORM') {
    const active = displayedOrganizations.filter(org => org.active);
    const onTrial = displayedOrganizations.filter(
      org => org.plan === 'TRIAL' && !trialEnded(org.plan, org.trialEndsAt),
    );
    const shown = filter === 'ACTIVE' ? active : filter === 'TRIAL' ? onTrial : displayedOrganizations;
    return (
      <section className="studio-manager-panel studio-platform-panel">
        <h2 className="visually-hidden">{L('Νοσοκομεία', 'Hospitals')}</h2>
        <div className="platform-toolbar">
          <QuickFilters
            label={L('Νοσοκομεία', 'Hospitals')}
            items={[
              {key: 'ALL', label: L('Όλα', 'All'), count: displayedOrganizations.length},
              {key: 'ACTIVE', label: L('Ενεργά', 'Active'), count: active.length},
              {key: 'TRIAL', label: L('Σε δοκιμαστική περίοδο', 'On trial'), count: onTrial.length},
            ].map(f => ({
              ...f,
              active: filter === f.key,
              onClick: () => setFilter(filter === f.key ? 'ALL' : (f.key as HospitalFilter)),
            }))}
          />
          <AppButton variant="primary" onClick={() => setOrganizationEditor(null)}>
            <Plus size={16} />
            {L('Νέο νοσοκομείο', 'New hospital')}
          </AppButton>
        </div>
        <HospitalList s={s} organizations={shown} />
      </section>
    );
  }
  const views: Array<{id: DemoView; label: string}> = [
    ...(cloud ? [{id: 'EVALUATION' as const, label: L('Demo υποψήφιων πελατών', 'Prospects’ Demos')}] : []),
    {id: 'PRIVATE', label: L('Δικό μου Demo', 'My Demo')},
  ];
  const current: DemoView = !cloud ? 'PRIVATE' : view;
  return (
    <section className="studio-manager-panel studio-platform-panel">
      <header className="studio-panel-head">
        <div>
          <span className="eyebrow">{L('ΠΛΑΤΦΟΡΜΑ', 'PLATFORM')}</span>
          <h2>{L('Demo αξιολόγησης', 'Evaluation Demos')}</h2>
          <p>
            {L(
              'Ξεχωριστό νοσοκομείο με δοκιμαστικά δεδομένα, που κλειδώνει στη λήξη του. Για πελάτη που ξεκινά: «Νέο νοσοκομείο» με δοκιμαστική περίοδο.',
              'A separate hospital with sample data that locks when it ends. For a customer who is starting: a «New hospital» on trial.',
            )}
          </p>
        </div>
        {cloud && (
          <div className="platform-head-actions">
            <AppButton
              variant="primary"
              title={L(
                'Με δοκιμαστικά δεδομένα, για παρουσίαση σε υποψήφιο πελάτη',
                'With sample data, to show a prospective customer',
              )}
              onClick={() => {
                setView('EVALUATION');
                setCreatingDemo(true);
              }}
            >
              <FlaskConical size={16} />
              {L('Νέο Demo αξιολόγησης', 'New evaluation Demo')}
            </AppButton>
          </div>
        )}
      </header>
      {views.length > 1 && (
        <nav className="platform-views" aria-label={L('Ενότητες', 'Sections')}>
          {views.map(v => (
            <button
              key={v.id}
              className={current === v.id ? 'active' : ''}
              aria-pressed={current === v.id}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </nav>
      )}
      {current === 'EVALUATION' && <DemoAccountsPanel creating={creatingDemo} onCreatingChange={setCreatingDemo} />}
      {current === 'PRIVATE' && <PrivateDemo s={s} />}
    </section>
  );
}

function HospitalList({s, organizations}: {s: StudioPageState; organizations: Organization[]}) {
  const [network, setNetwork] = useState<Organization | null>(null);
  const {L, changePlan, cloudDepartments, displayedUsers, openOrganization} = s;
  if (!organizations.length)
    return <div className="studio-empty">{L('Δεν υπάρχουν νοσοκομεία.', 'No hospitals yet.')}</div>;
  return (
    <div className="platform-hospitals" role="list">
      {organizations.map(org => {
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
                {org.code}
                {/* On a narrow screen the counts have no columns of their own: they follow the code. */}
                <span className="platform-hospital-counts-inline">
                  {' '}
                  · {users} {L('χρήστες', 'users')} · {departments} {L('τμήματα', 'departments')}
                </span>
              </small>
            </div>
            <div className="platform-hospital-badges">
              <PlanBadge org={org} L={L} />
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
              {/* Only what differs from the usual is coloured: an inactive hospital, an open Demo. */}
              {!org.active && <span className="platform-status off">{L('Ανενεργό', 'Inactive')}</span>}
              {org.demoEnabled && <span className="platform-status demo">{L('Demo ανοικτό', 'Demo open')}</span>}
            </div>
            {/* The number of users opens them: the hospital's people, roles and departments. */}
            <button
              type="button"
              className="platform-hospital-count platform-hospital-users"
              onClick={() => openOrganization(org)}
              title={L('Χρήστες και τμήματα του νοσοκομείου', "The hospital's users and departments")}
            >
              <strong>{users}</strong>
              <small>{L('χρήστες', 'users')}</small>
            </button>
            <div className="platform-hospital-count">
              <strong>{departments}</strong>
              <small>{L('τμήματα', 'departments')}</small>
            </div>
            <div className="platform-hospital-actions">
              {org.id === activeHospitalId() ? (
                <span className="platform-here">{L('Εδώ εργάζεστε', 'Working here')}</span>
              ) : (
                <AppButton className="platform-enter" disabled={!org.active} onClick={() => switchHospital(org.id)}>
                  <LogIn size={15} />
                  {L('Είσοδος', 'Enter')}
                </AppButton>
              )}
              <ActionMenu
                icon={<MoreHorizontal size={15} />}
                label={L('Ενέργειες', 'Actions')}
                align="right"
                items={hospitalActions(s, org, setNetwork)}
              />
            </div>
          </article>
        );
      })}
      {network && <NetworkAccessDialog organization={network} onClose={() => setNetwork(null)} />}
    </div>
  );
}

/** Everything else a hospital's row can do, behind one menu instead of a row of buttons. */
function hospitalActions(
  s: StudioPageState,
  org: Organization,
  openNetwork: (org: Organization) => void,
): ActionMenuItem[] {
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
      key: 'users',
      icon: <Users size={15} />,
      label: L('Χρήστες & τμήματα', 'Users & departments'),
      hint: L('Οι άνθρωποι του νοσοκομείου, οι ρόλοι και τα τμήματα', "The hospital's people, roles and departments"),
      onSelect: () => s.openOrganization(org),
    },
    {
      key: 'edit',
      icon: <Pencil size={15} />,
      label: L('Επεξεργασία', 'Edit'),
      hint: L('Όνομα, κωδικός, χρήση και λήξη', 'Name, code, use and end date'),
      onSelect: () => setOrganizationEditor(org),
    },
    {
      key: 'network',
      icon: <Network size={15} />,
      label: L('Πρόσβαση ανά δίκτυο', 'Access by network'),
      hint: L(
        'Μόνο από τις διευθύνσεις του νοσοκομείου, με εξαιρέσεις',
        'Only from the hospital addresses, with exceptions',
      ),
      onSelect: () => openNetwork(org),
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
