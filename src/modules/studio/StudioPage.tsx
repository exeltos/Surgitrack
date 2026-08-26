import {useMemo, useState} from 'react';
import {setRuntimeDataMode} from '../../config/dataMode';
import {
  BookOpen,
  Building2,
  Factory,
  FlaskConical,
  Gauge,
  KeyRound,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserCog,
  Users,
  Warehouse,
  X,
  Pencil,
  CheckCircle2,
  Layers3,
  Lock,
  Save,
  type LucideIcon,
} from 'lucide-react';
import {useAppPreferences} from '../../core/AppPreferences';
import {useLibraries, type LibraryKey, type AdminUser, type Organization} from '../../core/LibraryStore';
import type {LibraryItem} from '../../core/libraries';
import type {UserRole} from '../../store/types';
import {useSurgi} from '../../store/SurgiStore';
import {
  defaultRolePermissions,
  permissionAvailableForRole,
  permissionCatalog,
  permissionKeys,
  protectedRolePermissions,
  roleHomePath,
  type Permission,
  type PermissionGroup,
} from '../../core/permissions';
import AppButton from '../../components/ui/AppButton';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

type Tab = 'OVERVIEW' | 'PLATFORM' | 'LIBRARIES' | 'WORKFLOW' | 'USERS' | 'ROLES' | 'SYSTEM';
const roles: Array<{id: UserRole; el: string; en: string; descriptionEl: string; descriptionEn: string}> = [
  {
    id: 'ADMIN',
    el: 'Διαχειριστής',
    en: 'Administrator',
    descriptionEl: 'Πλήρης διαχείριση SurgiTrack, βιβλιοθηκών, χρηστών και ρυθμίσεων.',
    descriptionEn: 'Full SurgiTrack, libraries, users and configuration access.',
  },
  {
    id: 'STERILIZATION',
    el: 'Αποστείρωση',
    en: 'Sterilization',
    descriptionEl: 'Παραλαβή, έλεγχος, σύνθεση, κλιβανισμός, παράδοση και διαχείριση assets.',
    descriptionEn: 'Receipt, preparation, sterilization, delivery and asset management.',
  },
  {
    id: 'DEPARTMENT',
    el: 'Τμήμα',
    en: 'Department',
    descriptionEl: 'Προβολή των assets του τμήματος, αναφορές και ηλεκτρονική αποστολή προς Αποστείρωση.',
    descriptionEn: 'View department assets, report issues and electronically dispatch to Sterilization.',
  },
];
const permissionGroupMeta: Record<PermissionGroup, {el: string; en: string}> = {
  ASSETS: {el: 'Assets & Stock', en: 'Assets & Stock'},
  WORKFLOW: {el: 'Ροές εργασίας', en: 'Workflow'},
  TRACEABILITY: {el: 'Ιχνηλασιμότητα & Αναφορές', en: 'Traceability & Reports'},
  ADMIN: {el: 'Διαχείριση συστήματος', en: 'System administration'},
};
const libraryMeta: Array<{key: LibraryKey; el: string; en: string; icon: LucideIcon; hintEl: string; hintEn: string}> =
  [
    {
      key: 'departments',
      el: 'Τμήματα',
      en: 'Departments',
      icon: Building2,
      hintEl: 'Κοινή λίστα τμημάτων για χρήστες, Σετ και εργαλεία.',
      hintEn: 'Shared departments used by users, sets and instruments.',
    },
    {
      key: 'specialties',
      el: 'Ειδικότητες',
      en: 'Specialties',
      icon: Stethoscope,
      hintEl: 'Χειρουργικές / κλινικές ειδικότητες.',
      hintEn: 'Surgical and clinical specialties.',
    },
    {
      key: 'manufacturers',
      el: 'Κατασκευαστές',
      en: 'Manufacturers',
      icon: Factory,
      hintEl: 'Κατασκευαστές εργαλείων και Σετ.',
      hintEn: 'Instrument and set manufacturers.',
    },
    {
      key: 'suppliers',
      el: 'Προμηθευτές',
      en: 'Suppliers',
      icon: Warehouse,
      hintEl: 'Προμηθευτές και συνεργάτες service.',
      hintEn: 'Suppliers and service partners.',
    },
    {
      key: 'toolCategories',
      el: 'Κατηγορίες εργαλείων',
      en: 'Instrument categories',
      icon: BookOpen,
      hintEl: 'Κοινές κατηγορίες ταξινόμησης εργαλείων.',
      hintEn: 'Shared instrument classification categories.',
    },
    {
      key: 'sterilizers',
      el: 'Κλίβανοι',
      en: 'Sterilizers',
      icon: FlaskConical,
      hintEl: 'Κλίβανοι που χρησιμοποιούνται στους κύκλους αποστείρωσης.',
      hintEn: 'Sterilizers available for sterilization cycles.',
    },
  ];

export default function StudioPage() {
  const {lang} = useAppPreferences();
  const libs = useLibraries();
  const {currentUser, setRole} = useSurgi();
  const [tab, setTab] = useState<Tab>('OVERVIEW');
  const [libraryKey, setLibraryKey] = useState<LibraryKey>('departments');
  const [query, setQuery] = useState('');
  const [editItem, setEditItem] = useState<LibraryItem | null>(null);
  const [newItem, setNewItem] = useState(false);
  const [userEditor, setUserEditor] = useState<AdminUser | null | undefined>(undefined);
  const [organizationEditor, setOrganizationEditor] = useState<Organization | null | undefined>(undefined);
  const [confirm, setConfirm] = useState<{title: string; message: string; action: () => void} | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('STERILIZATION');
  const [roleDraft, setRoleDraft] = useState<Permission[]>(() => [
    ...(libs.rolePermissions?.STERILIZATION || defaultRolePermissions.STERILIZATION),
  ]);

  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const handleResetSterilizationWorkflow = () => {
    libs.resetSterilizationWorkflow(currentUser.name);
  };
  const enterBuiltInDemo = (role: UserRole) => {
    const sessionUser = {
      id: `builtin-demo-${role.toLowerCase()}`,
      name:
        role === 'ADMIN' ? 'Demo Διαχειριστής' : role === 'STERILIZATION' ? 'Demo Αποστείρωση' : 'Demo Τμήμα',
      role,
      department:
        role === 'DEPARTMENT'
          ? 'Χειρουργείο'
          : role === 'STERILIZATION'
            ? 'Κεντρική Αποστείρωση'
            : 'Διαχείριση',
    };
    sessionStorage.setItem('surgitrack-session-user', JSON.stringify(sessionUser));
    sessionStorage.setItem('surgitrack-demo-role', role);
    sessionStorage.setItem('surgitrack-active-organization', 'org-iaso-thessalias');
    setRuntimeDataMode('DEMO');
    setRole(role);
    window.location.hash = `#${roleHomePath(role)}`;
    window.location.reload();
  };
  const enterOrganizationDemo = (organization: Organization, role: UserRole) => {
    if (!organization.active || !organization.demoEnabled) return;
    const candidate = libs.users.find(
      user =>
        user.organizationId === organization.id &&
        user.role === role &&
        user.active &&
        (role === 'ADMIN' || user.demoEnabled),
    );
    const sessionUser = candidate
      ? {id: candidate.id, name: candidate.name, role: candidate.role, department: candidate.department}
      : {
          id: `demo-${organization.id}-${role.toLowerCase()}`,
          name:
        role === 'ADMIN' ? 'Demo Διαχειριστής' : role === 'STERILIZATION' ? 'Demo Αποστείρωση' : 'Demo Τμήμα',
          role,
          department: role === 'DEPARTMENT' ? libs.departments[0]?.el || 'Τμήμα' : role === 'STERILIZATION' ? 'Κεντρική Αποστείρωση' : 'Διαχείριση',
        };
    sessionStorage.setItem('surgitrack-session-user', JSON.stringify(sessionUser));
    sessionStorage.setItem('surgitrack-demo-role', role);
    sessionStorage.setItem('surgitrack-active-organization', organization.id);
    setRuntimeDataMode('DEMO');
    setRole(role);
    window.location.hash = `#${roleHomePath(role)}`;
    window.location.reload();
  };
  const currentMeta = libraryMeta.find(x => x.key === libraryKey)!;
  const currentItems = libs[libraryKey];
  const filteredItems = currentItems.filter(x =>
    `${x.el} ${x.en} ${x.code || ''}`.toLowerCase().includes(query.toLowerCase()),
  );
  const filteredUsers = libs.users.filter(u => {
    const organizationName = libs.organizations.find(org => org.id === u.organizationId)?.name || '';
    return `${u.name} ${u.email} ${u.department} ${u.role} ${organizationName}`.toLowerCase().includes(query.toLowerCase());
  });
  const activeUsers = libs.users.filter(u => u.active).length;
  const totalLibraryRecords = libraryMeta.reduce((sum, m) => sum + libs[m.key].length, 0);
  const departmentUsers = libs.users.filter(u => u.role === 'DEPARTMENT').length;
  const roleCount = useMemo(
    () => roles.map(r => ({role: r.id, count: libs.users.filter(u => u.role === r.id && u.active).length})),
    [libs.users],
  );
  const resetQuery = () => setQuery('');
  const selectTab = (next: Tab) => {
    setTab(next);
    resetQuery();
  };
  const currentRolePermissions = (libs.rolePermissions?.[selectedRole] ||
    defaultRolePermissions[selectedRole]) as readonly Permission[];
  const protectedPermissionSet = new Set<Permission>(protectedRolePermissions[selectedRole]);
  const roleDirty = permissionKeys.some(
    permission => roleDraft.includes(permission) !== currentRolePermissions.includes(permission),
  );
  const selectRole = (role: UserRole) => {
    setSelectedRole(role);
    setRoleDraft([...(libs.rolePermissions?.[role] || defaultRolePermissions[role])]);
  };
  const toggleRolePermission = (permission: Permission) => {
    if (protectedPermissionSet.has(permission) || !permissionAvailableForRole(selectedRole, permission)) return;
    setRoleDraft(current =>
      current.includes(permission) ? current.filter(p => p !== permission) : [...current, permission],
    );
  };
  const saveRolePermissions = () => {
    libs.updateRolePermissions(selectedRole, roleDraft, currentUser.name);
    setRoleDraft([...roleDraft]);
  };
  const resetSelectedRole = () => {
    libs.resetRolePermissions(selectedRole, currentUser.name);
    setRoleDraft([...defaultRolePermissions[selectedRole]]);
  };
  const visiblePermissionGroups = (Object.keys(permissionGroupMeta) as PermissionGroup[])
    .map(group => ({
      group,
      permissions: permissionCatalog.filter(
        item => item.group === group && permissionAvailableForRole(selectedRole, item.key),
      ),
    }))
    .filter(item => item.permissions.length > 0);

  return (
    <div className="studio-workspace">
      <div className="studio-head">
        <div>
          <span className="eyebrow">SURGITRACK ADMIN</span>
          <h1>{L('SurgiTrack Studio', 'SurgiTrack Studio')}</h1>
          <p>
            {L(
              'Κεντρική διαχείριση νοσοκομείων, χρηστών, demo πρόσβασης, βιβλιοθηκών και βασικών παραμέτρων του SurgiTrack.',
              'Central administration of hospitals, users, demo access, libraries and core SurgiTrack settings.',
            )}
          </p>
        </div>
        <div className="studio-health">
          <ShieldCheck size={20} />
          <div>
            <strong>{L('Shared Core ενεργό', 'Shared Core active')}</strong>
            <span>
              {libs.dataMode === 'DEMO'
                ? L(
                    'Οι αλλαγές αποθηκεύονται τοπικά στο demo και χρησιμοποιούνται στις λειτουργικές φόρμες.',
                    'Demo changes persist locally and are used by operational forms.',
                  )
                : L(
                    'Production mode: οι βιβλιοθήκες και οι χρήστες ξεκινούν χωρίς demo δεδομένα.',
                    'Production mode: libraries and users start without demo data.',
                  )}
            </span>
          </div>
        </div>
      </div>
      <div className="studio-tabs" role="tablist">
        <button className={tab === 'OVERVIEW' ? 'active' : ''} onClick={() => selectTab('OVERVIEW')}>
          <Gauge size={17} />
          {L('Επισκόπηση', 'Overview')}
        </button>
        <button className={tab === 'PLATFORM' ? 'active' : ''} onClick={() => selectTab('PLATFORM')}>
          <Building2 size={17} />
          {L('Νοσοκομεία & Demo', 'Hospitals & Demo')}
        </button>
        <button className={tab === 'LIBRARIES' ? 'active' : ''} onClick={() => selectTab('LIBRARIES')}>
          <BookOpen size={17} />
          {L('Βιβλιοθήκες', 'Libraries')}
        </button>
        <button className={tab === 'WORKFLOW' ? 'active' : ''} onClick={() => selectTab('WORKFLOW')}>
          <Layers3 size={17} />
          {L('Ροή Αποστείρωσης', 'Sterilization Flow')}
        </button>
        <button className={tab === 'USERS' ? 'active' : ''} onClick={() => selectTab('USERS')}>
          <Users size={17} />
          {L('Χρήστες', 'Users')}
        </button>
        <button className={tab === 'ROLES' ? 'active' : ''} onClick={() => selectTab('ROLES')}>
          <UserCog size={17} />
          {L('Ρόλοι & Δικαιώματα', 'Roles & Permissions')}
        </button>
        <button className={tab === 'SYSTEM' ? 'active' : ''} onClick={() => selectTab('SYSTEM')}>
          <Settings2 size={17} />
          {L('Ρυθμίσεις', 'Settings')}
        </button>
      </div>
      <div className={`studio-body studio-body-${tab.toLowerCase()}`}>
        {tab === 'OVERVIEW' && (
          <div className="studio-overview">
            <div className="studio-kpis">
              <div>
                <BookOpen />
                <span>{L('Εγγραφές βιβλιοθηκών', 'Library records')}</span>
                <strong>{totalLibraryRecords}</strong>
              </div>
              <div>
                <Users />
                <span>{L('Ενεργοί χρήστες', 'Active users')}</span>
                <strong>{activeUsers}</strong>
              </div>
              <div>
                <Building2 />
                <span>{L('Τμήματα', 'Departments')}</span>
                <strong>{libs.departments.length}</strong>
              </div>
              <div>
                <ShieldCheck />
                <span>{L('Ρόλοι', 'Roles')}</span>
                <strong>{roles.length}</strong>
              </div>
            </div>
            <section className="studio-overview-grid">
              <div className="studio-overview-card">
                <header>
                  <div>
                    <span className="eyebrow">CORE LIBRARIES</span>
                    <h2>{L('Βιβλιοθήκες SurgiTrack', 'SurgiTrack libraries')}</h2>
                  </div>
                  <AppButton onClick={() => selectTab('LIBRARIES')}>{L('Διαχείριση', 'Manage')}</AppButton>
                </header>
                <div className="studio-library-summary">
                  {libraryMeta.map(m => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.key}
                        onClick={() => {
                          setLibraryKey(m.key);
                          selectTab('LIBRARIES');
                        }}
                      >
                        <span>
                          <Icon size={18} />
                        </span>
                        <div>
                          <b>{L(m.el, m.en)}</b>
                          <small>
                            {libs[m.key].length} {L('εγγραφές', 'records')}
                          </small>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="studio-overview-card">
                <header>
                  <div>
                    <span className="eyebrow">ACCESS CONTROL</span>
                    <h2>{L('Πρόσβαση χρηστών', 'User access')}</h2>
                  </div>
                  <AppButton onClick={() => selectTab('USERS')}>{L('Χρήστες', 'Users')}</AppButton>
                </header>
                <div className="studio-role-summary">
                  {roles.map(r => {
                    const count = roleCount.find(x => x.role === r.id)?.count || 0;
                    return (
                      <div key={r.id}>
                        <span className={`studio-role-dot role-${r.id.toLowerCase()}`}></span>
                        <div>
                          <b>{L(r.el, r.en)}</b>
                          <small>
                            {count} {L('ενεργοί', 'active')}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="studio-mini-note">
                  <KeyRound size={17} />
                  <span>
                    {L(
                      `${departmentUsers} χρήστες Τμήματος έχουν πρόσβαση μόνο στα assets του δηλωμένου τμήματός τους.`,
                      `${departmentUsers} Department users are restricted to assets assigned to their department.`,
                    )}
                  </span>
                </div>
              </div>
            </section>
          </div>
        )}
        {tab === 'PLATFORM' && (
          <section className="studio-manager-panel studio-platform-panel">
            <header className="studio-panel-head">
              <div>
                <span className="eyebrow">PLATFORM ADMIN</span>
                <h2>{L('Νοσοκομεία & πρόσβαση Demo', 'Hospitals & Demo access')}</h2>
                <p>
                  {L(
                    'Ο κεντρικός διαχειριστής βλέπει όλους τους οργανισμούς και αποφασίζει πού επιτρέπεται δοκιμαστική πρόσβαση.',
                    'The platform administrator can see all organizations and decide where demo access is allowed.',
                  )}
                </p>
              </div>
              <AppButton variant="primary" onClick={() => setOrganizationEditor(null)}>
                <Plus size={16} />
                {L('Νέο νοσοκομείο', 'New hospital')}
              </AppButton>
            </header>
            <div className="platform-kpis">
              <div><span>{L('Νοσοκομεία', 'Hospitals')}</span><strong>{libs.organizations.length}</strong></div>
              <div><span>{L('Ενεργά', 'Active')}</span><strong>{libs.organizations.filter(org => org.active).length}</strong></div>
              <div><span>{L('Demo ενεργό', 'Demo enabled')}</span><strong>{libs.organizations.filter(org => org.demoEnabled).length}</strong></div>
              <div><span>{L('Σύνολο χρηστών', 'Total users')}</span><strong>{libs.users.length}</strong></div>
            </div>
            <section className="platform-private-demo">
              <div>
                <span className="eyebrow">{L('ΙΔΙΩΤΙΚΟ DEMO', 'PRIVATE DEMO')}</span>
                <strong>
                  {L('Περιβάλλον πρακτικής με δοκιμαστικά δεδομένα', 'Practice environment with sample data')}
                </strong>
                <small>
                  {L(
                    'Τα Set, εργαλεία, κινήσεις, προβλήματα και δείγματα ροών υπάρχουν μόνο εδώ και δεν αναμιγνύονται με την κανονική βάση.',
                    'Sets, instruments, movements, issues and workflow samples exist only here and never mix with the normal data store.',
                  )}
                </small>
              </div>
              <div className="platform-private-demo-actions">
                <button onClick={() => enterBuiltInDemo('ADMIN')}>{L('Demo ως Admin', 'Demo as Admin')}</button>
                <button onClick={() => enterBuiltInDemo('STERILIZATION')}>
                  {L('Demo Αποστείρωσης', 'Sterilization Demo')}
                </button>
                <button onClick={() => enterBuiltInDemo('DEPARTMENT')}>
                  {L('Demo Τμήματος', 'Department Demo')}
                </button>
              </div>
            </section>
            <div className="platform-org-list">
              {libs.organizations.map(org => {
                const orgUsers = libs.users.filter(user => user.organizationId === org.id);
                const demoUsers = orgUsers.filter(user => user.demoEnabled).length;
                return (
                  <article className="platform-org-card" key={org.id}>
                    <div className="platform-org-main">
                      <div className="platform-org-icon"><Building2 size={20} /></div>
                      <div>
                        <strong>{org.name}</strong>
                        <small>{org.code} · {orgUsers.length} {L('χρήστες', 'users')}</small>
                      </div>
                    </div>
                    <div className="platform-org-status">
                      <button className={`studio-access-toggle ${org.active ? 'active' : ''}`} onClick={() => libs.updateOrganization(org.id, {active: !org.active})}>
                        <span></span>{org.active ? L('Ενεργό', 'Active') : L('Ανενεργό', 'Inactive')}
                      </button>
                      <button className={`studio-access-toggle demo ${org.demoEnabled ? 'active' : ''}`} onClick={() => libs.updateOrganization(org.id, {demoEnabled: !org.demoEnabled})}>
                        <span></span>{org.demoEnabled ? L('Demo ανοικτό', 'Demo open') : L('Demo κλειστό', 'Demo closed')}
                      </button>
                    </div>
                    <div className="platform-demo-actions">
                      <span>{L('Είσοδος Demo ως:', 'Enter Demo as:')}</span>
                      <button disabled={!org.active || !org.demoEnabled} onClick={() => enterOrganizationDemo(org, 'ADMIN')}>{L('Admin', 'Admin')}</button>
                      <button disabled={!org.active || !org.demoEnabled} onClick={() => enterOrganizationDemo(org, 'STERILIZATION')}>{L('Αποστείρωση', 'Sterilization')}</button>
                      <button disabled={!org.active || !org.demoEnabled} onClick={() => enterOrganizationDemo(org, 'DEPARTMENT')}>{L('Τμήμα', 'Department')}</button>
                    </div>
                    <div className="platform-org-meta">
                      <span>{L('Demo χρήστες', 'Demo users')}: <b>{demoUsers}</b></span>
                      <button onClick={() => setOrganizationEditor(org)}><Pencil size={16} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
            {!libs.organizations.length && <div className="studio-empty">{L('Δεν υπάρχουν νοσοκομεία.', 'No hospitals yet.')}</div>}
          </section>
        )}
        {tab === 'LIBRARIES' && (
          <div className="studio-manager">
            <aside className="studio-manager-nav">
              {libraryMeta.map(m => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.key}
                    className={libraryKey === m.key ? 'active' : ''}
                    onClick={() => {
                      setLibraryKey(m.key);
                      resetQuery();
                    }}
                  >
                    <span>
                      <Icon size={18} />
                    </span>
                    <div>
                      <b>{L(m.el, m.en)}</b>
                      <small>
                        {libs[m.key].length} {L('εγγραφές', 'records')}
                      </small>
                    </div>
                  </button>
                );
              })}
            </aside>
            <section className="studio-manager-panel">
              <header className="studio-panel-head">
                <div>
                  <span className="eyebrow">LIBRARY</span>
                  <h2>{L(currentMeta.el, currentMeta.en)}</h2>
                  <p>{L(currentMeta.hintEl, currentMeta.hintEn)}</p>
                </div>
                <AppButton variant="primary" onClick={() => setNewItem(true)}>
                  <Plus size={16} />
                  {L('Νέα εγγραφή', 'New record')}
                </AppButton>
              </header>
              <div className="studio-search">
                <Search size={17} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={L('Αναζήτηση ονομασίας ή κωδικού...', 'Search name or code...')}
                />
              </div>
              <div className="studio-list-head">
                <span>{L('Ονομασία', 'Name')}</span>
                <span>{L('Αγγλικά', 'English')}</span>
                <span>{L('Κωδικός', 'Code')}</span>
                <span></span>
              </div>
              <div className="studio-scroll-list">
                {filteredItems.map(item => (
                  <div className="studio-list-row" key={item.id}>
                    <strong>{item.el}</strong>
                    <span>{item.en}</span>
                    <code>{item.code || '—'}</code>
                    <div>
                      <button title={L('Επεξεργασία', 'Edit')} onClick={() => setEditItem(item)}>
                        <Pencil size={16} />
                      </button>
                      <button
                        className="danger-icon"
                        title={L('Διαγραφή', 'Delete')}
                        onClick={() =>
                          setConfirm({
                            title: L('Διαγραφή εγγραφής;', 'Delete record?'),
                            message: L(
                              `Η εγγραφή «${item.el}» θα αφαιρεθεί από τη βιβλιοθήκη.`,
                              `“${item.en}” will be removed from the library.`,
                            ),
                            action: () => libs.removeItem(libraryKey, item.id),
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {!filteredItems.length && (
                  <div className="studio-empty">{L('Δεν βρέθηκαν εγγραφές.', 'No records found.')}</div>
                )}
              </div>
            </section>
          </div>
        )}
        {tab === 'WORKFLOW' && (
          <div className="studio-workflow-page">
            <section className="studio-workflow-hero">
              <div>
                <span className="eyebrow">CSSD WORKFLOW ENGINE</span>
                <h2>{L('Ροή επανεπεξεργασίας', 'Reprocessing workflow')}</h2>
                <p>
                  {L(
                    'Το κάθε νοσοκομείο επιλέγει ποια στάδια θα αποτελούν υποχρεωτικό σημείο ελέγχου. Τα απενεργοποιημένα στάδια παρακάμπτονται αυτόματα χωρίς να χάνεται η ιχνηλασιμότητα.',
                    'Each hospital chooses which stages are explicit control gates. Disabled stages are skipped automatically without losing traceability.',
                  )}
                </p>
              </div>
              <div className="studio-workflow-profile">
                <small>{L('Προφίλ μονάδας', 'Facility profile')}</small>
                <input
                  defaultValue={libs.sterilizationWorkflow.profileName}
                  onBlur={e => {
                    const name = e.target.value.trim();
                    if (name && name !== libs.sterilizationWorkflow.profileName)
                      libs.updateSterilizationWorkflow({profileName: name}, currentUser.name, 'Μετονομασία προφίλ ροής');
                  }}
                />
                <span>v{libs.sterilizationWorkflow.version}</span>
              </div>
            </section>
            <section className="studio-workflow-policy">
              <ShieldCheck size={19} />
              <div>
                <strong>{L('Ασφαλής βασικός κορμός', 'Protected core workflow')}</strong>
                <span>
                  {L(
                    'Παραλαβή, Αποστείρωση και Παράδοση αποτελούν βασικά σημεία chain of custody και παραμένουν ενεργά. Τα ενδιάμεσα quality gates προσαρμόζονται ανά νοσοκομείο.',
                    'Receipt, Sterilization and Delivery are protected chain-of-custody milestones. Intermediate quality gates can be configured per hospital.',
                  )}
                </span>
              </div>
            </section>
            <section className="studio-release-policy">
              <header>
                <ShieldCheck size={18} />
                <div>
                  <strong>{L('Πολιτική παραλαβής', 'Receipt policy')}</strong>
                  <span>
                    {L(
                      'Η βασική παραλαβή παραμένει γρήγορη. Η καταμέτρηση Σετ ενεργοποιείται μόνο αν απαιτείται από την πολιτική της μονάδας.',
                      'Keep routine receipt fast. Set counting is enabled only when required by facility policy.',
                    )}
                  </span>
                </div>
              </header>
              <div className="studio-release-policy-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={libs.sterilizationWorkflow.receiptPolicy?.countSetsAtReceipt ?? false}
                    onChange={e =>
                      libs.updateSterilizationWorkflow({
                        receiptPolicy: {
                          ...(libs.sterilizationWorkflow.receiptPolicy || {
                            countSetsAtReceipt: false,
                            allowCrossDepartmentHandover: true,
                          }),
                          countSetsAtReceipt: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <b>{L('Καταμέτρηση Σετ κατά την παραλαβή', 'Count sets at receipt')}</b>
                    <small>
                      {L(
                        'Εμφανίζει μόνο αναμενόμενα / παραληφθέντα τεμάχια. Δεν αντικαθιστά τον Έλεγχο & Σύνθεση.',
                        'Shows expected / received quantity only. It does not replace Inspection & Assembly.',
                      )}
                    </small>
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={libs.sterilizationWorkflow.receiptPolicy?.allowCrossDepartmentHandover ?? true}
                    onChange={e =>
                      libs.updateSterilizationWorkflow({
                        receiptPolicy: {
                          ...(libs.sterilizationWorkflow.receiptPolicy || {
                            countSetsAtReceipt: false,
                            allowCrossDepartmentHandover: true,
                          }),
                          allowCrossDepartmentHandover: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <b>{L('Ελεγχόμενη παραλαβή από άλλο τμήμα', 'Controlled cross-department handover')}</b>
                    <small>
                      {L(
                        'Επιτρέπεται μόνο με προειδοποίηση και υποχρεωτική αιτιολόγηση.',
                        'Allowed only with warning and mandatory justification.',
                      )}
                    </small>
                  </span>
                </label>
              </div>
            </section>
            <section className="studio-release-policy">
              <header>
                <ShieldCheck size={18} />
                <div>
                  <strong>{L('Πολιτική αποδέσμευσης φορτίου', 'Load release policy')}</strong>
                  <span>
                    {L(
                      'Κεντρικοί κανόνες CI/BI που εφαρμόζονται σε κάθε φορτίο του νοσοκομείου.',
                      'Central CI/BI rules applied to every load in this facility.',
                    )}
                  </span>
                </div>
              </header>
              <div className="studio-release-policy-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={libs.sterilizationWorkflow.releasePolicy?.requireChemicalIndicator ?? true}
                    onChange={e =>
                      libs.updateSterilizationWorkflow({
                        releasePolicy: {
                          ...(libs.sterilizationWorkflow.releasePolicy || {
                            requireChemicalIndicator: true,
                            biologicalIndicator: 'OPTIONAL',
                            allowReleaseWhileBiPending: false,
                          }),
                          requireChemicalIndicator: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <b>{L('Υποχρεωτικός χημικός δείκτης', 'Chemical indicator required')}</b>
                    <small>
                      {L(
                        'Η αποδέσμευση μπλοκάρει αν ο CI δεν είναι αποδεκτός.',
                        'Release is blocked unless CI is acceptable.',
                      )}
                    </small>
                  </span>
                </label>
                <label>
                  <span>
                    <b>{L('Βιολογικός δείκτης (BI)', 'Biological indicator (BI)')}</b>
                    <small>
                      {L(
                        'Ορίζεται σύμφωνα με την πολιτική του νοσοκομείου και τον τύπο κύκλου.',
                        'Defined by facility policy and cycle type.',
                      )}
                    </small>
                  </span>
                  <select
                    value={libs.sterilizationWorkflow.releasePolicy?.biologicalIndicator || 'OPTIONAL'}
                    onChange={e =>
                      libs.updateSterilizationWorkflow({
                        releasePolicy: {
                          ...(libs.sterilizationWorkflow.releasePolicy || {
                            requireChemicalIndicator: true,
                            biologicalIndicator: 'OPTIONAL',
                            allowReleaseWhileBiPending: false,
                          }),
                          biologicalIndicator: e.target.value as 'OPTIONAL' | 'REQUIRED' | 'NOT_REQUIRED',
                        },
                      })
                    }
                  >
                    <option value="OPTIONAL">{L('Κατά περίπτωση', 'As required')}</option>
                    <option value="REQUIRED">{L('Υποχρεωτικός', 'Required')}</option>
                    <option value="NOT_REQUIRED">
                      {L('Δεν χρησιμοποιείται ως release gate', 'Not a release gate')}
                    </option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={libs.sterilizationWorkflow.releasePolicy?.allowReleaseWhileBiPending ?? false}
                    disabled={
                      (libs.sterilizationWorkflow.releasePolicy?.biologicalIndicator || 'OPTIONAL') === 'NOT_REQUIRED'
                    }
                    onChange={e =>
                      libs.updateSterilizationWorkflow({
                        releasePolicy: {
                          ...(libs.sterilizationWorkflow.releasePolicy || {
                            requireChemicalIndicator: true,
                            biologicalIndicator: 'OPTIONAL',
                            allowReleaseWhileBiPending: false,
                          }),
                          allowReleaseWhileBiPending: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <b>{L('Επιτρέπεται αποδέσμευση με BI σε αναμονή', 'Allow release while BI is pending')}</b>
                    <small>
                      {L(
                        'Να ενεργοποιείται μόνο αν προβλέπεται από την εγκεκριμένη πολιτική της μονάδας.',
                        'Enable only when permitted by the facility approved policy.',
                      )}
                    </small>
                  </span>
                </label>
              </div>
            </section>
            <div className="studio-workflow-list">
              {libs.sterilizationWorkflow.stages.map((stage, index) => (
                <section key={stage.id} className={`studio-workflow-stage ${stage.enabled ? 'enabled' : 'disabled'}`}>
                  <div className="workflow-stage-index">{String(index + 1).padStart(2, '0')}</div>
                  <div className="workflow-stage-main">
                    <div>
                      <strong>{L(stage.labelEl, stage.labelEn)}</strong>
                      {stage.locked && <span className="workflow-core-chip">CORE</span>}
                    </div>
                    <p>{L(stage.descriptionEl, stage.descriptionEn)}</p>
                    <div className="workflow-check-preview">
                      {(lang === 'el' ? stage.checksEl : stage.checksEn).map(check => (
                        <span key={check}>
                          <CheckCircle2 size={14} />
                          {check}
                        </span>
                      ))}
                    </div>
                  </div>
                  <label className={`workflow-stage-toggle ${stage.locked ? 'locked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={stage.enabled}
                      disabled={stage.locked}
                      onChange={e => libs.setWorkflowStageEnabled(stage.id, e.target.checked, currentUser.name)}
                    />
                    <span></span>
                    <b>{stage.enabled ? L('Ενεργό', 'Active') : L('Παράκαμψη', 'Skipped')}</b>
                  </label>
                </section>
              ))}
            </div>
            <details className="released-loads">
              <summary>{L('Ιστορικό εκδόσεων ροής', 'Workflow version history')} · {libs.workflowVersions.length}</summary>
              <div>
                {libs.workflowVersions.slice(0, 8).map(version => (
                  <div key={version.id}>
                    <span>
                      <b>v{version.version}</b> · {version.profileName}
                      <small style={{display: 'block'}}>{version.changeReason || L('Αλλαγή παραμετροποίησης', 'Configuration change')}</small>
                    </span>
                    <span>{version.changedBy} · {version.effectiveFrom ? new Date(version.effectiveFrom).toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB') : L('Αρχική', 'Initial')}</span>
                  </div>
                ))}
              </div>
            </details>
            <footer className="studio-workflow-footer">
              <div>
                <strong>{L('Ενεργή διαδρομή', 'Active route')}</strong>
                <span>
                  {libs.sterilizationWorkflow.stages
                    .filter(stage => stage.enabled)
                    .map(stage => L(stage.labelEl, stage.labelEn))
                    .join(' → ')}
                </span>
              </div>
              <AppButton onClick={handleResetSterilizationWorkflow}>
                <RefreshCcw size={16} />
                {L('Επαναφορά προτύπου', 'Reset template')}
              </AppButton>
            </footer>
          </div>
        )}
        {tab === 'USERS' && (
          <section className="studio-manager-panel studio-users-panel">
            <header className="studio-panel-head">
              <div>
                <span className="eyebrow">ACCESS CONTROL</span>
                <h2>{L('Χρήστες SurgiTrack', 'SurgiTrack users')}</h2>
                <p>
                  {L(
                    'Δημιουργία χρήστη, τμήμα, ρόλος και ενεργή πρόσβαση. Δεν αποθηκεύονται κωδικοί πρόσβασης εδώ.',
                    'Create users, assign department and role, and control active access. Passwords are not stored here.',
                  )}
                </p>
              </div>
              <AppButton variant="primary" onClick={() => setUserEditor(null)}>
                <Plus size={16} />
                {L('Νέος χρήστης', 'New user')}
              </AppButton>
            </header>
            <div className="studio-search">
              <Search size={17} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={L(
                  'Αναζήτηση χρήστη, email, τμήματος ή ρόλου...',
                  'Search user, email, department or role...',
                )}
              />
            </div>
            <div className="studio-user-head">
              <span>{L('Χρήστης', 'User')}</span>
              <span>{L('Νοσοκομείο', 'Hospital')}</span>
              <span>{L('Τμήμα', 'Department')}</span>
              <span>{L('Ρόλος', 'Role')}</span>
              <span>{L('Πρόσβαση', 'Access')}</span>
              <span>Demo</span>
              <span></span>
            </div>
            <div className="studio-scroll-list">
              {filteredUsers.map(u => (
                <div className="studio-user-row" key={u.id}>
                  <div>
                    <strong>{u.name}</strong>
                    <small>{u.email}</small>
                  </div>
                  <span>{libs.organizations.find(org => org.id === u.organizationId)?.name || '—'}</span>
                  <span>{u.department}</span>
                  <span className="role-chip">
                    {L(roles.find(r => r.id === u.role)?.el || u.role, roles.find(r => r.id === u.role)?.en || u.role)}
                  </span>
                  <button
                    className={`studio-access-toggle ${u.active ? 'active' : ''}`}
                    onClick={() => libs.updateUser(u.id, {active: !u.active})}
                  >
                    <span></span>
                    {u.active ? L('Ενεργός', 'Active') : L('Ανενεργός', 'Inactive')}
                  </button>
                  <button
                    className={`studio-access-toggle demo ${u.demoEnabled ? 'active' : ''}`}
                    disabled={u.role === 'ADMIN'}
                    title={u.role === 'ADMIN' ? L('Ο Platform Admin έχει πάντα πρόσβαση.', 'Platform Admin always has access.') : ''}
                    onClick={() => libs.updateUser(u.id, {demoEnabled: !u.demoEnabled})}
                  >
                    <span></span>
                    {u.role === 'ADMIN' ? L('Admin', 'Admin') : u.demoEnabled ? 'Demo ON' : 'Demo OFF'}
                  </button>
                  <div className="studio-row-actions">
                    <button onClick={() => setUserEditor(u)}>
                      <Pencil size={16} />
                    </button>
                    <button
                      className="danger-icon"
                      onClick={() =>
                        setConfirm({
                          title: L('Διαγραφή χρήστη;', 'Delete user?'),
                          message: L(
                            `Ο χρήστης ${u.name} θα αφαιρεθεί από το demo μητρώο χρηστών.`,
                            `User ${u.name} will be removed from the demo user registry.`,
                          ),
                          action: () => libs.removeUser(u.id),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
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
                        {count} {L('ενεργοί χρήστες', 'active users')}
                      </small>
                    </div>
                  </button>
                );
              })}
            </aside>
            <section className="studio-role-permission-panel">
              <header className="studio-role-permission-head">
                <div>
                  <span className="eyebrow">{L('ROLE PERMISSIONS', 'ROLE PERMISSIONS')}</span>
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
                    {roleCount.find(x => x.role === selectedRole)?.count || 0} {L('ενεργοί', 'active')}
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
                        <strong>
                          {L(permissionGroupMeta[section.group].el, permissionGroupMeta[section.group].en)}
                        </strong>
                        <span>
                          {section.permissions.filter(item => roleDraft.includes(item.key)).length}/
                          {section.permissions.length}
                        </span>
                      </header>
                      <div>
                        {section.permissions.map(item => {
                          const locked = protectedPermissionSet.has(item.key);
                          const checked = roleDraft.includes(item.key);
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
                                  {L('Προστατευμένο', 'Protected')}
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
                      <span>
                        {new Date(entry.at).toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
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
        {tab === 'SYSTEM' && (
          <div className="studio-system-grid">
            <section>
              <header>
                <Settings2 />
                <div>
                  <h3>{L('Κανόνες κύκλου ζωής', 'Lifecycle rules')}</h3>
                  <p>
                    {L(
                      'Κεντρικές παράμετροι που πρέπει να είναι κοινές σε όλη την εφαρμογή.',
                      'Central parameters shared across the application.',
                    )}
                  </p>
                </div>
              </header>
              <label>
                {L('Προειδοποίηση υπολοίπου χρήσεων', 'Remaining-use warning')}
                <div className="studio-setting-input">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={libs.systemSettings.usageWarningThreshold}
                    onChange={e =>
                      libs.updateSystemSettings({
                        usageWarningThreshold: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                      }, currentUser.name)
                    }
                  />
                  <span>{L('χρήσεις', 'uses')}</span>
                </div>
                <small>
                  {L(
                    'Εφαρμόζεται στις ειδοποιήσεις και στις καρτέλες περιορισμένων χρήσεων.',
                    'Applied to alerts and limited-use asset cards.',
                  )}
                </small>
              </label>
              <label>
                {L('Barcode Σετ', 'Set barcode')}
                <div className="studio-static-field">
                  <b>S + 6 ψηφία</b>
                  <span>S000321</span>
                </div>
              </label>
              <label>
                {L('Barcode Εργαλείου', 'Instrument barcode')}
                <div className="studio-static-field">
                  <b>T + 6 ψηφία</b>
                  <span>T001250</span>
                </div>
              </label>
            </section>
            <section>
              <header>
                <ShieldCheck />
                <div>
                  <h3>{L('Ασφάλεια & Audit', 'Security & Audit')}</h3>
                  <p>
                    {L(
                      'Οι μεταφορές και οι κρίσιμες ενέργειες διατηρούν ταυτότητα χρήστη και χρονική σήμανση.',
                      'Transfers and critical actions retain user identity and timestamps.',
                    )}
                  </p>
                </div>
              </header>
              <div className="studio-check-row">
                <CheckCircle2 />
                <span>{L('Ηλεκτρονική υπογραφή χρήστη σε μεταφορά', 'User electronic signature on transfer')}</span>
              </div>
              <div className="studio-check-row">
                <CheckCircle2 />
                <span>{L('Καταγραφή chain of custody', 'Chain-of-custody logging')}</span>
              </div>
              <details className="released-loads">
                <summary>{L('Ιστορικό παραμετροποίησης', 'Configuration audit')} · {libs.configurationAudit.length}</summary>
                <div>
                  {libs.configurationAudit.slice(0, 10).map(event => (
                    <div key={event.id}>
                      <span><b>{event.entityType}</b> · {event.entityId}</span>
                      <span>{event.by} · {new Date(event.at).toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB')}</span>
                    </div>
                  ))}
                  {!libs.configurationAudit.length && <small>{L('Δεν υπάρχουν ακόμη αλλαγές.', 'No changes recorded yet.')}</small>}
                </div>
              </details>
              <div className="studio-check-row">
                <CheckCircle2 />
                <span>{L('Δεν αποθηκεύονται κωδικοί πρόσβασης στο Studio', 'Passwords are not stored in Studio')}</span>
              </div>
              <AppButton
                onClick={() =>
                  setConfirm({
                    title:
                      libs.dataMode === 'DEMO'
                        ? L('Επαναφορά demo ρυθμίσεων;', 'Reset demo settings?')
                        : L('Καθαρισμός τοπικών ρυθμίσεων;', 'Clear local settings?'),
                    message:
                      libs.dataMode === 'DEMO'
                        ? L(
                            'Θα επανέλθουν οι αρχικές βιβλιοθήκες και οι demo χρήστες.',
                            'Initial libraries and demo users will be restored.',
                          )
                        : L(
                            'Οι τοπικές βιβλιοθήκες και οι χρήστες θα επανέλθουν σε καθαρή production κατάσταση.',
                            'Local libraries and users will return to a clean production state.',
                          ),
                    action: libs.resetData,
                  })
                }
              >
                <RefreshCcw size={16} />
                {libs.dataMode === 'DEMO'
                  ? L('Επαναφορά demo δεδομένων', 'Reset demo data')
                  : L('Καθαρισμός τοπικών δεδομένων', 'Clear local data')}
              </AppButton>
            </section>
          </div>
        )}
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
      {userEditor !== undefined && (
        <UserEditor
          user={userEditor || undefined}
          departments={libs.departments.map(d => d.el)}
          organizations={libs.organizations}
          onClose={() => setUserEditor(undefined)}
          onSave={data => {
            if (userEditor) libs.updateUser(userEditor.id, data);
            else libs.addUser(data);
            setUserEditor(undefined);
          }}
        />
      )}
      {organizationEditor !== undefined && (
        <OrganizationEditor
          organization={organizationEditor || undefined}
          onClose={() => setOrganizationEditor(undefined)}
          onSave={data => {
            if (organizationEditor) libs.updateOrganization(organizationEditor.id, data);
            else libs.addOrganization(data);
            setOrganizationEditor(undefined);
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={L('Επιβεβαίωση', 'Confirm')}
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

function LibraryEditor({
  item,
  title,
  onClose,
  onSave,
}: {
  item?: LibraryItem;
  title: string;
  onClose: () => void;
  onSave: (data: Omit<LibraryItem, 'id'>) => void;
}) {
  const [el, setEl] = useState(item?.el || '');
  const [en, setEn] = useState(item?.en || '');
  const [code, setCode] = useState(item?.code || '');
  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <aside className="studio-drawer">
        <header>
          <div>
            <span className="eyebrow">{title}</span>
            <h2>{item ? 'Επεξεργασία εγγραφής' : 'Νέα εγγραφή'}</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="studio-drawer-form">
          <label>
            Ονομασία (EL)
            <input autoFocus value={el} onChange={e => setEl(e.target.value)} />
          </label>
          <label>
            Ονομασία (EN)
            <input value={en} onChange={e => setEn(e.target.value)} />
          </label>
          <label>
            Κωδικός
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Προαιρετικό" />
          </label>
        </div>
        <footer>
          <AppButton onClick={onClose}>Ακύρωση</AppButton>
          <AppButton
            variant="primary"
            disabled={!el.trim() || !en.trim()}
            onClick={() => onSave({el: el.trim(), en: en.trim(), code: code.trim() || undefined})}
          >
            Αποθήκευση
          </AppButton>
        </footer>
      </aside>
    </div>
  );
}
function OrganizationEditor({
  organization,
  onClose,
  onSave,
}: {
  organization?: Organization;
  onClose: () => void;
  onSave: (data: Omit<Organization, 'id'>) => void;
}) {
  const [name, setName] = useState(organization?.name || '');
  const [code, setCode] = useState(organization?.code || '');
  const [active, setActive] = useState(organization?.active ?? true);
  const [demoEnabled, setDemoEnabled] = useState(organization?.demoEnabled ?? false);
  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <aside className="studio-drawer">
        <header>
          <div>
            <span className="eyebrow">PLATFORM ADMIN</span>
            <h2>{organization ? 'Επεξεργασία νοσοκομείου' : 'Νέο νοσοκομείο'}</h2>
          </div>
          <button onClick={onClose}><X /></button>
        </header>
        <div className="studio-drawer-form">
          <label>
            Ονομασία
            <input autoFocus value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label>
            Κωδικός
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="π.χ. IASO-TH" />
          </label>
          <label className="studio-switch-row">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            <span>Ενεργό νοσοκομείο</span>
          </label>
          <label className="studio-switch-row">
            <input type="checkbox" checked={demoEnabled} onChange={e => setDemoEnabled(e.target.checked)} />
            <span>Επιτρέπεται Demo πρόσβαση</span>
          </label>
          <div className="studio-form-note">
            <ShieldCheck size={16} />
            <span>Η Demo πρόσβαση δεν εμφανίζεται στη δημόσια αρχική. Ενεργοποιείται κεντρικά ανά νοσοκομείο και ανά χρήστη.</span>
          </div>
        </div>
        <footer>
          <AppButton onClick={onClose}>Ακύρωση</AppButton>
          <AppButton variant="primary" disabled={!name.trim() || !code.trim()} onClick={() => onSave({name: name.trim(), code: code.trim(), active, demoEnabled})}>
            Αποθήκευση
          </AppButton>
        </footer>
      </aside>
    </div>
  );
}

function UserEditor({
  user,
  departments,
  organizations,
  onClose,
  onSave,
}: {
  user?: AdminUser;
  departments: string[];
  organizations: Organization[];
  onClose: () => void;
  onSave: (data: Omit<AdminUser, 'id'>) => void;
}) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [department, setDepartment] = useState(user?.department || departments[0] || '');
  const [organizationId, setOrganizationId] = useState(user?.organizationId || organizations[0]?.id || '');
  const [role, setRole] = useState<UserRole>(user?.role || 'DEPARTMENT');
  const [active, setActive] = useState(user?.active ?? true);
  const [demoEnabled, setDemoEnabled] = useState(user?.demoEnabled ?? false);
  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <aside className="studio-drawer">
        <header>
          <div>
            <span className="eyebrow">ACCESS CONTROL</span>
            <h2>{user ? 'Επεξεργασία χρήστη' : 'Νέος χρήστης'}</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="studio-drawer-form">
          <label>
            Ονοματεπώνυμο
            <input autoFocus value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label>
            Νοσοκομείο
            <select value={organizationId} onChange={e => setOrganizationId(e.target.value)}>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </label>
          <label>
            Ρόλος
            <select value={role} onChange={e => {
              const next = e.target.value as UserRole;
              setRole(next);
              if (next === 'ADMIN') setDemoEnabled(true);
            }}>
              <option value="DEPARTMENT">Τμήμα</option>
              <option value="STERILIZATION">Αποστείρωση</option>
              <option value="ADMIN">Διαχειριστής</option>
            </select>
          </label>
          <label>
            Τμήμα
            <select value={department} onChange={e => setDepartment(e.target.value)}>
              {departments.map(d => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="studio-switch-row">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            <span>Ενεργή πρόσβαση</span>
          </label>
          <label className="studio-switch-row">
            <input
              type="checkbox"
              checked={role === 'ADMIN' || demoEnabled}
              disabled={role === 'ADMIN'}
              onChange={e => setDemoEnabled(e.target.checked)}
            />
            <span>Επιτρέπεται Demo πρόσβαση</span>
          </label>
          <div className="studio-form-note">
            <KeyRound size={16} />
            <span>
              Το SurgiTrack Studio δεν αποθηκεύει κωδικό πρόσβασης. Η ταυτότητα / reset password θα συνδεθεί με το
              authentication backend.
            </span>
          </div>
        </div>
        <footer>
          <AppButton onClick={onClose}>Ακύρωση</AppButton>
          <AppButton
            variant="primary"
            disabled={!name.trim() || !email.trim()}
            onClick={() => onSave({name: name.trim(), email: email.trim(), department, role, active, organizationId, demoEnabled: role === 'ADMIN' ? true : demoEnabled})}
          >
            Αποθήκευση
          </AppButton>
        </footer>
      </aside>
    </div>
  );
}
