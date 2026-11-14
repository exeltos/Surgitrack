import {useState} from 'react';
import {ShieldCheck} from 'lucide-react';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import OwnerDashboard from './OwnerDashboard';
import RolesGuide from './RolesGuide';
import AssetImportWizard from './AssetImportWizard';
import LibraryEditor from './LibraryEditor';
import OrganizationEditor from './OrganizationEditor';
import {useStudioPage} from './useStudioPage';
import StudioTabs from './tabs/StudioTabs';
import {useLocation} from 'react-router-dom';
import {isPlatformOnly} from '../../core/platformOnly';
import {STUDIO_TABS, type Tab} from './studioMeta';
import PlatformTab from './tabs/PlatformTab';
import LibrariesTab from './tabs/LibrariesTab';
import WorkflowTab from './tabs/WorkflowTab';
import UsersTab from './tabs/UsersTab';
import RolesTab from './tabs/RolesTab';
import SystemTab from './tabs/SystemTab';
import ErrorsTab from './tabs/ErrorsTab';
import SecurityTab from './tabs/SecurityTab';
import NoticesTab from './tabs/NoticesTab';
import RatingsTab from './tabs/RatingsTab';
import RequestsTab from './tabs/RequestsTab';

/** With the owner's menu each section is a page: its own one-line description under its title. */
const SECTION_TEXT: Record<Tab, [string, string]> = {
  OVERVIEW: ['Τι χρειάζεται προσοχή σήμερα σε όλα τα νοσοκομεία.', 'What needs attention today across hospitals.'],
  PLATFORM: ['Τύπος χρήσης, κατάσταση και είσοδος σε κάθε νοσοκομείο.', 'Plan, state and entry for each hospital.'],
  DEMOS: [
    'Demo με δοκιμαστικά δεδομένα, για παρουσίαση σε υποψήφιους πελάτες.',
    'Demos with sample data, to show prospective customers.',
  ],
  USERS: ['Οι χρήστες όλων των νοσοκομείων, ανά νοσοκομείο και ρόλο.', 'Every hospital’s users, by hospital and role.'],
  IMPORT: [
    'Μαζική εισαγωγή Σετ και εργαλείων σε ένα νοσοκομείο.',
    'Bulk import of Sets and instruments into a hospital.',
  ],
  RATINGS: ['Τι λένε οι χρήστες για κάθε λειτουργία.', 'What users say about each feature.'],
  REQUESTS: [
    'Όσοι ζήτησαν παρουσίαση από την πρώτη σελίδα του www.surgitrack.eu.',
    'Who asked for a demo on the first page of www.surgitrack.eu.',
  ],
  NOTICES: [
    'Ανακοινώσεις και προωθήσεις προς τους χρήστες και τους διαχειριστές των νοσοκομείων.',
    'Announcements and promotions to the users and the administrators of the hospitals.',
  ],
  ERRORS: ['Σφάλματα που συνάντησαν οι χρήστες στην εφαρμογή.', 'Errors users ran into in the app.'],
  SECURITY: [
    'Συνδεδεμένοι αυτή τη στιγμή με τη διεύθυνσή τους, και μπλοκάρισμα διευθύνσεων ή χρηστών.',
    'Who is connected right now with their address, and blocking addresses or users.',
  ],
  LIBRARIES: [
    'Οι κοινές λίστες με τις οποίες ξεκινά κάθε νέο νοσοκομείο.',
    'The shared lists every new hospital starts with.',
  ],
  WORKFLOW: ['Τα στάδια της Αποστείρωσης για τα νέα νοσοκομεία.', 'The sterilization stages for new hospitals.'],
  ROLES: ['Τι μπορεί να κάνει κάθε ρόλος.', 'What each role can do.'],
  SYSTEM: ['Επαφή υποστήριξης, ετικέτες και γενικές ρυθμίσεις.', 'Support contact, labels and general settings.'],
};

/** Inside a hospital the same sections set up that hospital, not the ones to come. */
const HOSPITAL_SECTION_TEXT: Partial<Record<Tab, [string, string]>> = {
  LIBRARIES: [
    'Οι λίστες του νοσοκομείου: ειδικότητες, κατασκευαστές, κλίβανοι και άλλες.',
    'The hospital’s lists: specialties, makers, sterilizers and more.',
  ],
  WORKFLOW: [
    'Τα στάδια της Αποστείρωσης του νοσοκομείου και οι κανόνες τους.',
    'The hospital’s sterilization stages and their rules.',
  ],
  ROLES: ['Τι μπορεί να κάνει κάθε ρόλος στο νοσοκομείο.', 'What each role can do in the hospital.'],
  SYSTEM: [
    'Διάρκεια αποστείρωσης, ετικέτες, κλείδωμα οθόνης και υπενθυμίσεις.',
    'Sterile shelf life, labels, screen lock and reminders.',
  ],
};

export default function StudioPage() {
  const s = useStudioPage();
  const [rolesView, setRolesView] = useState<'PERMISSIONS' | 'GUIDE'>('PERMISSIONS');
  // A menu entry opens one section («?tab=…»): the page shows it, titled, with no tab rows.
  const section = new URLSearchParams(useLocation().search).get('tab')
    ? STUDIO_TABS.find(t => t.id === s.tab)
    : undefined;
  const {
    L,
    changePlan,
    cloudDepartments,
    confirm,
    currentMeta,
    currentUser,
    displayedOrganizations,
    displayedUsers,
    editItem,
    lang,
    libraryKey,
    libs,
    newItem,
    organizationEditor,
    platformAdmin,
    saveOrganization,
    selectTab,
    setConfirm,
    setEditItem,
    setNewItem,
    setOrganizationEditor,
    setSelectedOrganizationId,
    tab,
  } = s;
  return (
    // A section's page title already names it: its panel heading would say the same thing again
    // (Libraries keeps its own, which names the list being edited).
    <div className={`studio-workspace${section && section.id !== 'LIBRARIES' ? ' studio-section-page' : ''}`}>
      <div className="studio-head">
        <div>
          <span className="eyebrow">
            {platformAdmin
              ? L('ΔΙΑΧΕΙΡΙΣΗ ΠΛΑΤΦΟΡΜΑΣ', 'PLATFORM ADMINISTRATION')
              : L('Ρυθμίσεις νοσοκομείου', 'Hospital settings')}
          </span>
          <h1>{section ? L(section.el, section.en) : 'SurgiTrack Studio'}</h1>
          <p>
            {section
              ? L(...((!isPlatformOnly() && HOSPITAL_SECTION_TEXT[section.id]) || SECTION_TEXT[section.id]))
              : platformAdmin
                ? L(
                    'Νοσοκομεία, χρήστες, demo πρόσβαση και βιβλιοθήκες της πλατφόρμας.',
                    'Hospitals, users, demo access and libraries of the platform.',
                  )
                : L(
                    'Βιβλιοθήκες, ροή αποστείρωσης, δικαιώματα ρόλων και ρυθμίσεις του νοσοκομείου.',
                    'Libraries, sterilization flow, role permissions and hospital settings.',
                  )}
          </p>
        </div>
        <div
          className="studio-health"
          title={
            libs.dataMode === 'DEMO'
              ? L(
                  'Ξεχωριστό Demo νοσοκομείο· οι αλλαγές αποθηκεύονται μόνο εδώ.',
                  'Separate Demo hospital; changes are saved only here.',
                )
              : L('Πραγματικά νοσοκομεία, χρήστες και δεδομένα.', 'Real hospitals, users and data.')
          }
        >
          <ShieldCheck size={20} />
          <div>
            <strong>{libs.dataMode === 'DEMO' ? L('Demo', 'Demo') : L('Πραγματικά δεδομένα', 'Real data')}</strong>
            <span>
              {libs.dataMode === 'DEMO'
                ? L(
                    'Ξεχωριστό Demo νοσοκομείο· οι αλλαγές αποθηκεύονται μόνο εδώ.',
                    'Separate Demo hospital; changes are saved only here.',
                  )
                : L('Πραγματικά νοσοκομεία, χρήστες και δεδομένα.', 'Real hospitals, users and data.')}
            </span>
          </div>
        </div>
      </div>
      {!section && <StudioTabs s={s} />}
      <div className={`studio-body studio-body-${tab.toLowerCase()}`}>
        {tab === 'OVERVIEW' && platformAdmin && (
          <OwnerDashboard
            organizations={displayedOrganizations}
            users={displayedUsers}
            production={libs.dataMode === 'PRODUCTION'}
            L={L}
            onOpenUsers={id => {
              setSelectedOrganizationId(id);
              selectTab('USERS');
            }}
            onOpenHospitals={() => selectTab('PLATFORM')}
            onNewHospital={() => setOrganizationEditor(null)}
            onExtendTrial={(org, endsAt) => void changePlan(org, 'TRIAL', endsAt)}
          />
        )}
        <PlatformTab s={s} />
        <LibrariesTab s={s} />
        <WorkflowTab s={s} />
        <UsersTab s={s} />
        {tab === 'IMPORT' && platformAdmin && libs.dataMode === 'PRODUCTION' && (
          <AssetImportWizard
            lang={lang === 'el' ? 'el' : 'en'}
            organizations={displayedOrganizations.filter(o => o.active)}
            departments={cloudDepartments}
            byName={currentUser.name}
            choose
          />
        )}
        {tab === 'ROLES' && (
          // Roles and permissions in one tab: who does what, or each role's permissions to change.
          <div className="settings-categories" role="group" aria-label={L('Προβολή', 'View')}>
            <button
              type="button"
              aria-pressed={rolesView === 'PERMISSIONS'}
              className={`settings-category ${rolesView === 'PERMISSIONS' ? 'active' : ''}`}
              onClick={() => setRolesView('PERMISSIONS')}
            >
              {L('Δικαιώματα ανά ρόλο', 'Permissions by role')}
            </button>
            <button
              type="button"
              aria-pressed={rolesView === 'GUIDE'}
              className={`settings-category ${rolesView === 'GUIDE' ? 'active' : ''}`}
              onClick={() => setRolesView('GUIDE')}
            >
              {L('Ποιος κάνει τι', 'Who does what')}
            </button>
          </div>
        )}
        {tab === 'ROLES' && rolesView === 'GUIDE' ? <RolesGuide owner={platformAdmin} /> : <RolesTab s={s} />}
        <SystemTab s={s} />
        <ErrorsTab s={s} />
        <SecurityTab s={s} />
        <RatingsTab s={s} />
        <RequestsTab s={s} />
        <NoticesTab s={s} />
      </div>
      {(editItem || newItem) && (
        <LibraryEditor
          item={editItem || undefined}
          title={L(currentMeta.el, currentMeta.en)}
          onClose={() => {
            setEditItem(null);
            setNewItem(false);
          }}
          onSave={data => {
            if (editItem) libs.updateItem(libraryKey, editItem.id, data);
            else libs.addItem(libraryKey, data);
            setEditItem(null);
            setNewItem(false);
          }}
        />
      )}
      {organizationEditor !== undefined && (
        <OrganizationEditor
          organization={organizationEditor || undefined}
          onClose={() => setOrganizationEditor(undefined)}
          onSave={(data, hospitalAdmin) => {
            void saveOrganization(data, hospitalAdmin);
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel || L('Επιβεβαίωση', 'Confirm')}
          danger={confirm.danger}
          confirmText={confirm.confirmText}
          onConfirm={() => {
            confirm.action();
            setConfirm(null);
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
