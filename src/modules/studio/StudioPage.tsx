import {ShieldCheck} from 'lucide-react';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {supabase} from '../../lib/supabase';
import OwnerDashboard from './OwnerDashboard';
import RolesGuide from './RolesGuide';
import AssetImportWizard from './AssetImportWizard';
import LibraryEditor from './LibraryEditor';
import OrganizationEditor from './OrganizationEditor';
import {useStudioPage} from './useStudioPage';
import StudioTabs from './tabs/StudioTabs';
import PlatformTab from './tabs/PlatformTab';
import LibrariesTab from './tabs/LibrariesTab';
import WorkflowTab from './tabs/WorkflowTab';
import UsersTab from './tabs/UsersTab';
import RolesTab from './tabs/RolesTab';
import SystemTab from './tabs/SystemTab';

export default function StudioPage() {
  const s = useStudioPage();
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
    loadCloudDepartments,
    newItem,
    organizationEditor,
    platformAdmin,
    saveCloudDepartment,
    saveOrganization,
    selectTab,
    setCloudError,
    setConfirm,
    setEditItem,
    setNewItem,
    setOrganizationEditor,
    setSelectedOrganizationId,
    tab,
  } = s;
  return (
    <div className="studio-workspace">
      <div className="studio-head">
        <div>
          <span className="eyebrow">
            {platformAdmin
              ? L('ΔΙΑΧΕΙΡΙΣΗ ΠΛΑΤΦΟΡΜΑΣ', 'PLATFORM ADMINISTRATION')
              : L('ΡΥΘΜΙΣΕΙΣ ΝΟΣΟΚΟΜΕΙΟΥ', 'HOSPITAL SETTINGS')}
          </span>
          <h1>{L('SurgiTrack Studio', 'SurgiTrack Studio')}</h1>
          <p>
            {platformAdmin
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
            <strong>
              {libs.dataMode === 'DEMO' ? L('Περιβάλλον Demo', 'Demo environment') : L('Παραγωγή', 'Production')}
            </strong>
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
      <StudioTabs s={s} />
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
          />
        )}
        {tab === 'GUIDE' && <RolesGuide />}
        <RolesTab s={s} />
        <SystemTab s={s} />
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
            if (libs.dataMode === 'PRODUCTION' && libraryKey === 'departments') {
              if (editItem) {
                void supabase
                  .rpc('platform_update_department', {
                    p_id: editItem.id,
                    p_name: data.el,
                    p_code: data.code || '',
                    p_active: true,
                  })
                  .then(({error}) => {
                    if (error) setCloudError(error.message);
                    else void loadCloudDepartments();
                  });
                setEditItem(null);
                setNewItem(false);
              } else void saveCloudDepartment(data);
            } else {
              if (editItem) libs.updateItem(libraryKey, editItem.id, data);
              else libs.addItem(libraryKey, data);
              setEditItem(null);
              setNewItem(false);
            }
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
