import {useEffect, useMemo, useState} from 'react';
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
  Upload,
  Send,
  Languages,
  UserCheck,
  UserPlus,
  type LucideIcon,
  Palette,
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
  isSupervisorOnly,
  roleHomePath,
  type Permission,
  type PermissionGroup,
} from '../../core/permissions';
import AppButton from '../../components/ui/AppButton';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {supabase} from '../../lib/supabase';
import SignupLinkCard from '../hospital/SignupLinkCard';
import {switchHospital} from '../../data/cloud/hospitalSwitch';
import {actingAsPlatformOwner} from '../../data/cloud/identity';
import {localizedName, translateToEnglish} from '../../core/glossary';
import {countPendingAccessRequests} from '../../data/cloud/accessRequests';
import {
  applyDemoSessionUser,
  demoSessionUser,
  hospitalRoleKinds,
  hospitalRoleNames,
  type DemoView,
  type HospitalRoleKind,
} from '../../config/demoRoles';
import {departments as defaultDepartments} from '../../core/libraries';
import {tr} from '../../i18n';
import RolesGuide from './RolesGuide';
import ColorTapeLibrary from './ColorTapeLibrary';

type Tab = 'OVERVIEW' | 'PLATFORM' | 'LIBRARIES' | 'WORKFLOW' | 'USERS' | 'GUIDE' | 'ROLES' | 'SYSTEM';
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
    descriptionEl:
      'Παραλαβή, έλεγχος, σύνθεση, κλιβανισμός και παράδοση. Ο Προϊστάμενος, που ορίζει ο διαχειριστής νοσοκομείου, καταχωρεί εργαλεία και Σετ, αλλάζει τη σύνθεσή τους και διαχειρίζεται το Service.',
    descriptionEn:
      'Receipt, inspection, assembly, sterilization and delivery. The supervisor, named by the hospital admin, registers instruments and Sets, changes their composition and handles service.',
  },
  {
    id: 'DEPARTMENT',
    el: 'Τμήμα',
    en: 'Department',
    descriptionEl: 'Προβολή των assets του τμήματος, αναφορές και ηλεκτρονική αποστολή προς Αποστείρωση.',
    descriptionEn: 'View department assets, report issues and electronically dispatch to Sterilization.',
  },
  {
    id: 'VIEWER',
    el: 'Παρατηρητής',
    en: 'Viewer',
    descriptionEl:
      'Μόνο προβολή (π.χ. Νοσηλευτική Διεύθυνση, Διεύθυνση Λειτουργιών): επισκόπηση, μητρώα, εκκρεμότητες, ιστορικό και αναφορές όλου του νοσοκομείου. Δεν αλλάζει τίποτα.',
    descriptionEn:
      'Read only (e.g. Nursing Directorate, Operations): overview, registries, issues, history and reports of the whole hospital. Changes nothing.',
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
  // The platform admin runs the whole platform; a hospital admin only configures their own hospital
  // here (libraries, workflow, permissions, settings) — no other hospitals, hospital record or Demo.
  const platformAdmin = actingAsPlatformOwner();
  // A real hospital's departments are managed on its own administration page.
  const hospitalLibraryMeta = libraryMeta.filter(
    m => platformAdmin || libs.dataMode !== 'PRODUCTION' || m.key !== 'departments',
  );
  const [tab, setTab] = useState<Tab>(platformAdmin ? 'OVERVIEW' : 'LIBRARIES');
  const [libraryKey, setLibraryKey] = useState<LibraryKey>(hospitalLibraryMeta[0].key);
  // The color tape palette has its own editor next to the plain libraries.
  const [tapesOpen, setTapesOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editItem, setEditItem] = useState<LibraryItem | null>(null);
  const [newItem, setNewItem] = useState(false);
  const [userEditor, setUserEditor] = useState<AdminUser | null | undefined>(undefined);
  const [organizationEditor, setOrganizationEditor] = useState<Organization | null | undefined>(undefined);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [pendingRequests, setPendingRequests] = useState(0);
  useEffect(() => {
    setPendingRequests(0);
    if (libs.dataMode !== 'PRODUCTION' || !selectedOrganizationId) return;
    void countPendingAccessRequests(selectedOrganizationId).then(setPendingRequests);
  }, [libs.dataMode, selectedOrganizationId]);
  // Approvals happen in the hospital's own workspace, which loads that hospital's data.
  const openHospitalAdministration = (organizationId: string) => switchHospital(organizationId, '#/hospital');
  const [cloudOrganizations, setCloudOrganizations] = useState<Organization[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [cloudUsers, setCloudUsers] = useState<AdminUser[]>([]);
  const [cloudDepartments, setCloudDepartments] = useState<
    Array<{id: string; organizationId: string; name: string; code: string; active: boolean}>
  >([]);
  const [bulkRows, setBulkRows] = useState<
    Array<{
      name: string;
      email: string;
      organizationId: string;
      departmentId: string;
      departmentName: string;
      role: UserRole;
      error?: string;
    }>
  >([]);
  const [bulkSending, setBulkSending] = useState(false);
  const [confirm, setConfirm] = useState<{title: string; message: string; action: () => void} | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('STERILIZATION');
  const [roleDraft, setRoleDraft] = useState<Permission[]>(() => [
    ...(libs.rolePermissions?.STERILIZATION || defaultRolePermissions.STERILIZATION),
  ]);

  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const loadCloudOrganizations = async () => {
    if (libs.dataMode !== 'PRODUCTION') return;
    setCloudLoading(true);
    // Demo hospitals are sandboxes, not customers: they are managed through the Demo buttons only.
    const {data, error} = await supabase
      .from('organizations')
      .select('id,name,code,active,demo_enabled')
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
        })),
      );
    }
    setCloudLoading(false);
  };
  useEffect(() => {
    if (platformAdmin) void loadCloudOrganizations();
  }, [libs.dataMode]);
  const displayedOrganizations = libs.dataMode === 'PRODUCTION' ? cloudOrganizations : libs.organizations;
  const loadCloudUsers = async () => {
    if (libs.dataMode !== 'PRODUCTION') return;
    const {data, error} = await supabase
      .from('profiles')
      .select('id,name,email,role,active,demo_enabled,organization_id,department_id')
      .not('organization_id', 'is', null)
      .order('name');
    if (error) {
      setCloudError(error.message);
      return;
    }
    setCloudUsers(
      (data || []).map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role as UserRole,
        active: row.active,
        demoEnabled: row.demo_enabled,
        organizationId: row.organization_id || '',
        department: row.department_id || '',
      })),
    );
  };
  useEffect(() => {
    if (platformAdmin) void loadCloudUsers();
  }, [libs.dataMode]);
  const displayedUsers = libs.dataMode === 'PRODUCTION' ? cloudUsers : libs.users;
  const selectedOrganization = displayedOrganizations.find(o => o.id === selectedOrganizationId);
  const selectedOrgDepartments = cloudDepartments.filter(d => d.organizationId === selectedOrganizationId);
  const selectedOrgUsers = displayedUsers.filter(u => u.organizationId === selectedOrganizationId);
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
  }, [libs.dataMode]);
  const saveCloudDepartment = async (item: Omit<LibraryItem, 'id'>) => {
    const org = selectedOrganization || displayedOrganizations[0];
    if (!org) {
      setCloudError(L('Δημιουργήστε πρώτα νοσοκομείο.', 'Create a hospital first.'));
      return;
    }
    const {error} = await supabase.rpc('platform_create_department', {
      p_organization_id: org.id,
      p_name: item.el,
      p_code: item.code || item.el.slice(0, 8),
    });
    if (error) {
      setCloudError(error.message);
      return;
    }
    setNewItem(false);
    await loadCloudDepartments();
  };
  const inviteUser = async (data: Omit<AdminUser, 'id'>) => {
    if (libs.dataMode === 'DEMO') {
      libs.addUser(data);
      setUserEditor(undefined);
      return;
    }
    const {data: result, error} = await supabase.functions.invoke('invite-staff', {
      body: {
        users: [
          {
            full_name: data.name,
            email: data.email,
            organization_id: data.organizationId,
            department_id: data.department || null,
            role: data.role,
          },
        ],
        redirect_to: window.location.origin,
      },
    });
    if (error || !result?.results?.[0]?.ok) {
      setCloudError(result?.results?.[0]?.error || error?.message || 'Invite failed');
      return;
    }
    setUserEditor(undefined);
    await loadCloudUsers();
  };
  const importCsv = async (file: File) => {
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean);
    const rows = lines.slice(1).map(line => {
      const parts = line.split(/[;,]/).map(x => x.trim().replace(/^"|"$/g, ''));
      const [name, email, hospital, department, roleRaw] = parts;
      const org = displayedOrganizations.find(
        o =>
          o.code.toLowerCase() === String(hospital || '').toLowerCase() ||
          o.name.toLowerCase() === String(hospital || '').toLowerCase(),
      );
      const dep = org
        ? cloudDepartments.find(
            d =>
              d.organizationId === org.id &&
              (d.code.toLowerCase() === String(department || '').toLowerCase() ||
                d.name.toLowerCase() === String(department || '').toLowerCase()),
          )
        : undefined;
      const role = (
        ['ADMIN', 'STERILIZATION', 'DEPARTMENT', 'VIEWER'].includes(String(roleRaw || '').toUpperCase())
          ? String(roleRaw).toUpperCase()
          : 'DEPARTMENT'
      ) as UserRole;
      const error =
        !name || !email.includes('@')
          ? L('Μη έγκυρο όνομα/email', 'Invalid name/email')
          : !org
            ? L('Άγνωστο νοσοκομείο', 'Unknown hospital')
            : role === 'DEPARTMENT' && !dep
              ? L('Άγνωστο τμήμα', 'Unknown department')
              : undefined;
      return {
        name,
        email,
        organizationId: org?.id || '',
        departmentId: dep?.id || '',
        departmentName: dep?.name || department || '',
        role,
        error,
      };
    });
    setBulkRows(rows);
  };
  const sendBulkInvites = async () => {
    if (!bulkRows.length || bulkRows.some(r => r.error)) return;
    setBulkSending(true);
    setCloudError('');
    const {data: result, error} = await supabase.functions.invoke('invite-staff', {
      body: {
        users: bulkRows.map(r => ({
          full_name: r.name,
          email: r.email,
          organization_id: r.organizationId,
          department_id: r.departmentId || null,
          role: r.role,
        })),
        redirect_to: window.location.origin,
      },
    });
    setBulkSending(false);
    if (error) {
      setCloudError(error.message);
      return;
    }
    const failed = (result?.results || []).filter((x: {ok: boolean}) => !x.ok);
    if (failed.length) {
      setCloudError(tr('{0} προσκλήσεις απέτυχαν.', failed.length));
    } else setBulkRows([]);
    await loadCloudUsers();
  };
  const setCloudUserAccess = async (u: AdminUser, patch: {active?: boolean; demoEnabled?: boolean}) => {
    if (libs.dataMode === 'DEMO') {
      libs.updateUser(u.id, patch);
      return;
    }
    const {error} = await supabase.rpc('platform_set_profile_access', {
      p_id: u.id,
      p_active: patch.active ?? u.active,
      p_demo_enabled: patch.demoEnabled ?? u.demoEnabled,
    });
    if (error) {
      setCloudError(error.message);
      return;
    }
    await loadCloudUsers();
  };
  const saveOrganization = async (data: Omit<Organization, 'id'>) => {
    if (libs.dataMode === 'DEMO') {
      if (organizationEditor) libs.updateOrganization(organizationEditor.id, data);
      else libs.addOrganization(data);
      setOrganizationEditor(undefined);
      return;
    }
    const {error} = organizationEditor
      ? await supabase.rpc('platform_update_organization', {
          p_id: organizationEditor.id,
          p_name: data.name,
          p_code: data.code,
          p_active: data.active,
          p_demo_enabled: data.demoEnabled,
        })
      : await supabase.rpc('platform_create_organization', {p_name: data.name, p_code: data.code});
    if (error) {
      setCloudError(error.message);
      return;
    }
    if (!organizationEditor && data.demoEnabled) {
      await loadCloudOrganizations();
    }
    setOrganizationEditor(undefined);
    await loadCloudOrganizations();
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
    // An admin opens the Demo hospital on its overview, like a real hospital admin.
    window.location.hash = `#${role === 'ADMIN' ? '/overview' : roleHomePath(role)}`;
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
      window.alert(
        L(
          'Το Demo επανήλθε. Την επόμενη φορά που θα μπείτε θα έχει ξανά τα αρχικά δοκιμαστικά δεδομένα.',
          'The Demo was reset. Next time you enter it will have the original sample data again.',
        ),
      );
  };
  const currentMeta = libraryMeta.find(x => x.key === libraryKey)!;
  const currentItems =
    libs.dataMode === 'PRODUCTION' && libraryKey === 'departments'
      ? cloudDepartments.map(d => ({id: d.id, el: d.name, en: d.name, code: d.code}))
      : libs[libraryKey];
  const filteredItems = currentItems.filter(x =>
    `${x.el} ${x.en} ${x.code || ''}`.toLowerCase().includes(query.toLowerCase()),
  );
  const filteredUsers = displayedUsers.filter(u => {
    if (selectedOrganizationId && u.organizationId !== selectedOrganizationId) return false;
    const organizationName = displayedOrganizations.find(org => org.id === u.organizationId)?.name || '';
    return `${u.name} ${u.email} ${u.department} ${u.role} ${organizationName}`
      .toLowerCase()
      .includes(query.toLowerCase());
  });
  const activeUsers = displayedUsers.filter(u => u.active).length;
  const totalLibraryRecords = libraryMeta.reduce((sum, m) => sum + libs[m.key].length, 0);
  const departmentUsers = displayedUsers.filter(u => u.role === 'DEPARTMENT').length;
  const roleCount = useMemo(
    () => roles.map(r => ({role: r.id, count: displayedUsers.filter(u => u.role === r.id && u.active).length})),
    [displayedUsers],
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
  // In Sterilization these follow who the hospital admin names supervisor, not the role settings.
  const supervisorOnlyFor = (permission: Permission) =>
    selectedRole === 'STERILIZATION' && isSupervisorOnly(permission);
  const toggleRolePermission = (permission: Permission) => {
    if (
      protectedPermissionSet.has(permission) ||
      supervisorOnlyFor(permission) ||
      !permissionAvailableForRole(selectedRole, permission)
    )
      return;
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
          <span className="eyebrow">
            {platformAdmin
              ? L('ΔΙΑΧΕΙΡΙΣΗ ΠΛΑΤΦΟΡΜΑΣ', 'PLATFORM ADMINISTRATION')
              : L('ΡΥΘΜΙΣΕΙΣ ΝΟΣΟΚΟΜΕΙΟΥ', 'HOSPITAL SETTINGS')}
          </span>
          <h1>{L('SurgiTrack Studio', 'SurgiTrack Studio')}</h1>
          <p>
            {platformAdmin
              ? L(
                  'Κεντρική διαχείριση νοσοκομείων, χρηστών, demo πρόσβασης, βιβλιοθηκών και βασικών παραμέτρων του SurgiTrack.',
                  'Central administration of hospitals, users, demo access, libraries and core SurgiTrack settings.',
                )
              : L(
                  'Βιβλιοθήκες, ροή αποστείρωσης, δικαιώματα ρόλων και ρυθμίσεις του νοσοκομείου σας. Τμήματα και χρήστες διαχειρίζεστε από τη «Διαχείριση νοσοκομείου».',
                  "Your hospital's libraries, sterilization flow, role permissions and settings. Departments and users are managed in “Hospital administration”.",
                )}
          </p>
        </div>
        <div className="studio-health">
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
      <div className="studio-tabs" role="tablist">
        {platformAdmin && (
          <button className={tab === 'OVERVIEW' ? 'active' : ''} onClick={() => selectTab('OVERVIEW')}>
            <Gauge size={17} />
            {L('Επισκόπηση', 'Overview')}
          </button>
        )}
        {platformAdmin && (
          <button className={tab === 'PLATFORM' ? 'active' : ''} onClick={() => selectTab('PLATFORM')}>
            <Building2 size={17} />
            {L('Νοσοκομεία & Demo', 'Hospitals & Demo')}
          </button>
        )}
        <button className={tab === 'LIBRARIES' ? 'active' : ''} onClick={() => selectTab('LIBRARIES')}>
          <BookOpen size={17} />
          {L('Βιβλιοθήκες', 'Libraries')}
        </button>
        <button className={tab === 'WORKFLOW' ? 'active' : ''} onClick={() => selectTab('WORKFLOW')}>
          <Layers3 size={17} />
          {L('Ροή Αποστείρωσης', 'Sterilization Flow')}
        </button>
        {platformAdmin && (
          <button className={tab === 'USERS' ? 'active' : ''} onClick={() => selectTab('USERS')}>
            <Users size={17} />
            {L('Χρήστες', 'Users')}
          </button>
        )}
        <button className={tab === 'GUIDE' ? 'active' : ''} onClick={() => selectTab('GUIDE')}>
          <ShieldCheck size={17} />
          {L('Ρόλοι', 'Roles')}
        </button>
        <button className={tab === 'ROLES' ? 'active' : ''} onClick={() => selectTab('ROLES')}>
          <UserCog size={17} />
          {L('Δικαιώματα', 'Permissions')}
        </button>
        <button className={tab === 'SYSTEM' ? 'active' : ''} onClick={() => selectTab('SYSTEM')}>
          <Settings2 size={17} />
          {L('Ρυθμίσεις', 'Settings')}
        </button>
      </div>
      <div className={`studio-body studio-body-${tab.toLowerCase()}`}>
        {tab === 'OVERVIEW' && platformAdmin && (
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
                <strong>{libs.dataMode === 'PRODUCTION' ? cloudDepartments.length : libs.departments.length}</strong>
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
                    <span className="eyebrow">{L('ΒΙΒΛΙΟΘΗΚΕΣ', 'LIBRARIES')}</span>
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
                    <span className="eyebrow">{L('ΕΛΕΓΧΟΣ ΠΡΟΣΒΑΣΗΣ', 'ACCESS CONTROL')}</span>
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
        {tab === 'LIBRARIES' && (
          <div className="studio-manager">
            <aside className="studio-manager-nav">
              {hospitalLibraryMeta.map(m => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.key}
                    className={!tapesOpen && libraryKey === m.key ? 'active' : ''}
                    onClick={() => {
                      setTapesOpen(false);
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
              <button className={tapesOpen ? 'active' : ''} onClick={() => setTapesOpen(true)}>
                <span>
                  <Palette size={18} />
                </span>
                <div>
                  <b>{L('Χρωματικοί μάρτυρες', 'Color markers')}</b>
                  <small>
                    {(libs.colorTapes || []).filter(t => t.active !== false).length} {L('σε χρήση', 'in use')}
                  </small>
                </div>
              </button>
            </aside>
            {tapesOpen ? (
              <section className="studio-manager-panel">
                <ColorTapeLibrary />
              </section>
            ) : (
              <section className="studio-manager-panel">
                <header className="studio-panel-head">
                  <div>
                    <span className="eyebrow">{L('ΒΙΒΛΙΟΘΗΚΗ', 'LIBRARY')}</span>
                    <h2>{L(currentMeta.el, currentMeta.en)}</h2>
                    <p>{L(currentMeta.hintEl, currentMeta.hintEn)}</p>
                  </div>
                  <AppButton variant="primary" onClick={() => setNewItem(true)}>
                    <Plus size={16} />
                    {L('Νέα εγγραφή', 'New record')}
                  </AppButton>
                </header>
                {cloudError && <div className="auth-message">{cloudError}</div>}
                {libs.dataMode === 'PRODUCTION' && bulkRows.length > 0 && (
                  <div className="studio-mini-note">
                    <Upload size={17} />
                    <span>
                      <b>{bulkRows.length}</b> {L('εγγραφές · ', 'rows · ')}
                      <b>{bulkRows.filter(r => !r.error).length}</b> {L('έγκυρες', 'valid')} ·{' '}
                      <b>{bulkRows.filter(r => r.error).length}</b> {L('με σφάλμα', 'with errors')}
                    </span>
                    <AppButton
                      variant="primary"
                      disabled={bulkSending || bulkRows.some(r => r.error)}
                      onClick={() => void sendBulkInvites()}
                    >
                      <Send size={15} />
                      {bulkSending ? L('Αποστολή...', 'Sending...') : L('Αποστολή προσκλήσεων', 'Send invitations')}
                    </AppButton>
                  </div>
                )}
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
            )}
          </div>
        )}
        {tab === 'WORKFLOW' && (
          <div className="studio-workflow-page">
            <section className="studio-workflow-hero">
              <div>
                <span className="eyebrow">{L('ΡΟΗ ΕΡΓΑΣΙΑΣ CSSD', 'CSSD WORKFLOW')}</span>
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
                      libs.updateSterilizationWorkflow(
                        {profileName: name},
                        currentUser.name,
                        'Μετονομασία προφίλ ροής',
                      );
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
              <summary>
                {L('Ιστορικό εκδόσεων ροής', 'Workflow version history')} · {libs.workflowVersions.length}
              </summary>
              <div>
                {libs.workflowVersions.slice(0, 8).map(version => (
                  <div key={version.id}>
                    <span>
                      <b>v{version.version}</b> · {version.profileName}
                      <small style={{display: 'block'}}>
                        {version.changeReason || L('Αλλαγή παραμετροποίησης', 'Configuration change')}
                      </small>
                    </span>
                    <span>
                      {version.changedBy} ·{' '}
                      {version.effectiveFrom
                        ? new Date(version.effectiveFrom).toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB')
                        : L('Αρχική', 'Initial')}
                    </span>
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
        {tab === 'USERS' && platformAdmin && (
          <section className="studio-manager-panel studio-users-panel">
            <header className="studio-panel-head">
              <div>
                <span className="eyebrow">{L('ΠΡΟΣΒΑΣΗ ΝΟΣΟΚΟΜΕΙΟΥ', 'HOSPITAL ACCESS')}</span>
                <h2>
                  {selectedOrganization ? selectedOrganization.name : L('Χρήστες & Τμήματα', 'Users & Departments')}
                </h2>
                <p>
                  {selectedOrganization
                    ? L(
                        'Κεντρική διαχείριση τμημάτων, χρηστών και προσκλήσεων.',
                        'Central management of departments, users and invitations.',
                      )
                    : L('Επιλέξτε νοσοκομείο.', 'Select a hospital.')}
                </p>
              </div>
              <select value={selectedOrganizationId} onChange={e => setSelectedOrganizationId(e.target.value)}>
                <option value="">{L('Επιλογή νοσοκομείου', 'Select hospital')}</option>
                {displayedOrganizations.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </header>
            {selectedOrganization && (
              <div className="hospital-admin-summary">
                <div>
                  <Building2 size={18} />
                  <span>{L('Τμήματα', 'Departments')}</span>
                  <strong>{selectedOrgDepartments.length}</strong>
                </div>
                <div>
                  <Users size={18} />
                  <span>{L('Χρήστες', 'Users')}</span>
                  <strong>{selectedOrgUsers.length}</strong>
                </div>
                <div>
                  <ShieldCheck size={18} />
                  <span>{L('Ενεργοί', 'Active')}</span>
                  <strong>{selectedOrgUsers.filter(u => u.active).length}</strong>
                </div>
                <div className={pendingRequests ? 'attention' : ''}>
                  <UserPlus size={18} />
                  <span>{L('Αιτήματα σε αναμονή', 'Pending requests')}</span>
                  <strong>{pendingRequests}</strong>
                </div>
              </div>
            )}
            {selectedOrganization && (
              <div className="hospital-access-row">
                <section className="hospital-departments">
                  <header>
                    <div>
                      <b>{L('Τμήματα νοσοκομείου', 'Hospital departments')}</b>
                      <small>
                        {L(
                          'Τα τμήματα χρησιμοποιούνται σε χρήστες, Σετ και ιχνηλασιμότητα.',
                          'Departments are used by users, sets and traceability.',
                        )}
                      </small>
                    </div>
                    <AppButton
                      onClick={() => {
                        setLibraryKey('departments');
                        setEditItem(null);
                        setNewItem(true);
                      }}
                    >
                      <Plus size={15} />
                      {L('Νέο τμήμα', 'New department')}
                    </AppButton>
                  </header>
                  <div className="hospital-department-list">
                    {selectedOrgDepartments.map(d => (
                      <div key={d.id}>
                        <span>
                          <b>{localizedName(d.name, lang)}</b>
                          <small>{d.code || '—'}</small>
                        </span>
                        <button
                          onClick={() => {
                            setLibraryKey('departments');
                            setEditItem({id: d.id, el: d.name, en: d.name, code: d.code});
                            setNewItem(false);
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
                {libs.dataMode === 'PRODUCTION' && (
                  <SignupLinkCard organizationId={selectedOrganization.id} onError={setCloudError}>
                    <div className="hospital-link-requests">
                      <span>
                        {pendingRequests
                          ? L(
                              `${pendingRequests} ${pendingRequests === 1 ? 'αίτημα περιμένει' : 'αιτήματα περιμένουν'} έγκριση`,
                              `${pendingRequests} ${pendingRequests === 1 ? 'request is' : 'requests are'} awaiting approval`,
                            )
                          : L('Κανένα αίτημα σε αναμονή', 'No requests awaiting approval')}
                      </span>
                      <AppButton size="sm" onClick={() => openHospitalAdministration(selectedOrganization.id)}>
                        <UserCheck size={14} />
                        {L('Αιτήματα & έγκριση', 'Requests & approval')}
                      </AppButton>
                    </div>
                  </SignupLinkCard>
                )}
              </div>
            )}
            <div className="hospital-users-toolbar">
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
              {selectedOrganization && (
                <>
                  <AppButton variant="primary" onClick={() => setUserEditor(null)}>
                    <Plus size={16} />
                    {L('Πρόσκληση χρήστη', 'Invite user')}
                  </AppButton>
                  {libs.dataMode === 'PRODUCTION' && (
                    <label className="app-button">
                      <Upload size={16} />
                      {L('Μαζική εισαγωγή CSV', 'Bulk CSV import')}
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        hidden
                        onChange={e => e.target.files?.[0] && void importCsv(e.target.files[0])}
                      />
                    </label>
                  )}
                </>
              )}
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
              {filteredUsers.length === 0 && (
                <div className="hospital-users-empty">
                  <Users size={22} />
                  <strong>
                    {query
                      ? L('Κανένας χρήστης δεν ταιριάζει στην αναζήτηση.', 'No user matches the search.')
                      : L('Δεν υπάρχουν χρήστες ακόμα.', 'No users yet.')}
                  </strong>
                  {!query && selectedOrganization && (
                    <small>
                      {L(
                        'Στείλτε πρόσκληση στον διαχειριστή του νοσοκομείου ή μοιραστείτε τον σύνδεσμο εγγραφής.',
                        "Invite the hospital's administrator or share the signup link.",
                      )}
                    </small>
                  )}
                </div>
              )}
              {filteredUsers.map(u => (
                <div className="studio-user-row" key={u.id}>
                  <div>
                    <strong>{u.name}</strong>
                    <small>{u.email}</small>
                  </div>
                  <span>{displayedOrganizations.find(org => org.id === u.organizationId)?.name || '—'}</span>
                  <span>
                    {libs.dataMode === 'PRODUCTION'
                      ? localizedName(cloudDepartments.find(d => d.id === u.department)?.name || '—', lang)
                      : u.department}
                  </span>
                  <span className="role-chip">
                    {L(roles.find(r => r.id === u.role)?.el || u.role, roles.find(r => r.id === u.role)?.en || u.role)}
                  </span>
                  <button
                    className={`studio-access-toggle ${u.active ? 'active' : ''}`}
                    onClick={() => void setCloudUserAccess(u, {active: !u.active})}
                  >
                    <span></span>
                    {u.active ? L('Ενεργός', 'Active') : L('Ανενεργός', 'Inactive')}
                  </button>
                  <button
                    className={`studio-access-toggle demo ${u.demoEnabled ? 'active' : ''}`}
                    disabled={u.role === 'ADMIN'}
                    title={
                      u.role === 'ADMIN'
                        ? L('Ο Platform Admin έχει πάντα πρόσβαση.', 'Platform Admin always has access.')
                        : ''
                    }
                    onClick={() => void setCloudUserAccess(u, {demoEnabled: !u.demoEnabled})}
                  >
                    <span></span>
                    {u.role === 'ADMIN' ? L('Admin', 'Admin') : u.demoEnabled ? 'Demo ON' : 'Demo OFF'}
                  </button>
                  <div className="studio-row-actions">
                    {libs.dataMode === 'DEMO' && (
                      <button onClick={() => setUserEditor(u)}>
                        <Pencil size={16} />
                      </button>
                    )}
                    {libs.dataMode === 'DEMO' && (
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
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {tab === 'GUIDE' && <RolesGuide />}
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
                        <strong>
                          {L(permissionGroupMeta[section.group].el, permissionGroupMeta[section.group].en)}
                        </strong>
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
                      libs.updateSystemSettings(
                        {
                          usageWarningThreshold: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                        },
                        currentUser.name,
                      )
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
                  <b>{tr('S + 6 ψηφία')}</b>
                  <span>S000321</span>
                </div>
              </label>
              <label>
                {L('Barcode Εργαλείου', 'Instrument barcode')}
                <div className="studio-static-field">
                  <b>{tr('T + 6 ψηφία')}</b>
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
                <summary>
                  {L('Ιστορικό παραμετροποίησης', 'Configuration audit')} · {libs.configurationAudit.length}
                </summary>
                <div>
                  {libs.configurationAudit.slice(0, 10).map(event => (
                    <div key={event.id}>
                      <span>
                        <b>{event.entityType}</b> · {event.entityId}
                      </span>
                      <span>
                        {event.by} · {new Date(event.at).toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB')}
                      </span>
                    </div>
                  ))}
                  {!libs.configurationAudit.length && (
                    <small>{L('Δεν υπάρχουν ακόμη αλλαγές.', 'No changes recorded yet.')}</small>
                  )}
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
      {userEditor !== undefined && (
        <UserEditor
          user={userEditor || undefined}
          departments={
            libs.dataMode === 'PRODUCTION' ? cloudDepartments.map(d => d.name) : libs.departments.map(d => d.el)
          }
          organizations={selectedOrganization ? [selectedOrganization] : displayedOrganizations}
          cloudDepartments={libs.dataMode === 'PRODUCTION' ? cloudDepartments : undefined}
          onClose={() => setUserEditor(undefined)}
          onSave={data => {
            if (userEditor && libs.dataMode === 'DEMO') {
              libs.updateUser(userEditor.id, data);
              setUserEditor(undefined);
            } else void inviteUser(data);
          }}
        />
      )}
      {organizationEditor !== undefined && (
        <OrganizationEditor
          organization={organizationEditor || undefined}
          onClose={() => setOrganizationEditor(undefined)}
          onSave={data => {
            void saveOrganization(data);
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
  const [code, setCode] = useState(item?.code || '');
  // One name only: the English comes from the built-in glossary (or stays as written).
  const english = translateToEnglish(el);
  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <aside className="studio-drawer">
        <header>
          <div>
            <span className="eyebrow">{title}</span>
            <h2>{item ? tr('Επεξεργασία εγγραφής') : tr('Νέα εγγραφή')}</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="studio-drawer-form">
          <label>
            {tr('Ονομασία')}
            <input autoFocus value={el} onChange={e => setEl(e.target.value)} />
          </label>
          {el.trim() && (
            <div className="studio-form-note">
              <Languages size={16} />
              <span>
                {english && english !== el.trim() ? (
                  <>
                    {tr('Στα αγγλικά θα εμφανίζεται ως') + ' '}
                    <b>{english}</b>.
                  </>
                ) : (
                  tr('Στα αγγλικά θα εμφανίζεται όπως το γράψατε.')
                )}
              </span>
            </div>
          )}
          <label>
            {tr('Κωδικός')}
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder={tr('Προαιρετικό')} />
          </label>
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            variant="primary"
            disabled={!el.trim()}
            onClick={() => onSave({el: el.trim(), en: english || el.trim(), code: code.trim() || undefined})}
          >
            {tr('Αποθήκευση')}
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
            <span className="eyebrow">{tr('ΝΟΣΟΚΟΜΕΙΟ')}</span>
            <h2>{organization ? tr('Επεξεργασία νοσοκομείου') : tr('Νέο νοσοκομείο')}</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="studio-drawer-form">
          <label>
            {tr('Ονομασία')}
            <input autoFocus value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label>
            {tr('Κωδικός')}
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder={tr('π.χ. IASO-TH')}
            />
          </label>
          <label className="studio-switch-row">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            <span>{tr('Ενεργό νοσοκομείο')}</span>
          </label>
          <label className="studio-switch-row">
            <input type="checkbox" checked={demoEnabled} onChange={e => setDemoEnabled(e.target.checked)} />
            <span>{tr('Επιτρέπεται Demo πρόσβαση')}</span>
          </label>
          <div className="studio-form-note">
            <ShieldCheck size={16} />
            <span>
              {tr(
                'Η Demo πρόσβαση δεν εμφανίζεται στη δημόσια αρχική. Ενεργοποιείται κεντρικά ανά νοσοκομείο και ανά χρήστη.',
              )}
            </span>
          </div>
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            variant="primary"
            disabled={!name.trim() || !code.trim()}
            onClick={() => onSave({name: name.trim(), code: code.trim(), active, demoEnabled})}
          >
            {tr('Αποθήκευση')}
          </AppButton>
        </footer>
      </aside>
    </div>
  );
}

function UserEditor({
  user,
  departments,
  cloudDepartments = [],
  organizations,
  onClose,
  onSave,
}: {
  user?: AdminUser;
  departments: string[];
  cloudDepartments?: Array<{id: string; organizationId: string; name: string}>;
  organizations: Organization[];
  onClose: () => void;
  onSave: (data: Omit<AdminUser, 'id'>) => void;
}) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [department, setDepartment] = useState(
    user?.department ||
      cloudDepartments.find(d => d.organizationId === (user?.organizationId || organizations[0]?.id))?.id ||
      departments[0] ||
      '',
  );
  const [organizationId, setOrganizationId] = useState(user?.organizationId || organizations[0]?.id || '');
  const [role, setRole] = useState<UserRole>(user?.role || 'DEPARTMENT');
  const [active, setActive] = useState(user?.active ?? true);
  const [demoEnabled, setDemoEnabled] = useState(user?.demoEnabled ?? false);
  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <aside className="studio-drawer">
        <header>
          <div>
            <span className="eyebrow">{tr('ΕΛΕΓΧΟΣ ΠΡΟΣΒΑΣΗΣ')}</span>
            <h2>{user ? tr('Επεξεργασία χρήστη') : tr('Νέος χρήστης')}</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="studio-drawer-form">
          <label>
            {tr('Ονοματεπώνυμο')}
            <input autoFocus value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label>
            {tr('Νοσοκομείο')}
            <select value={organizationId} onChange={e => setOrganizationId(e.target.value)}>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr('Ρόλος')}
            <select
              value={role}
              onChange={e => {
                const next = e.target.value as UserRole;
                setRole(next);
                if (next === 'ADMIN') setDemoEnabled(true);
              }}
            >
              <option value="DEPARTMENT">{tr('Τμήμα')}</option>
              <option value="STERILIZATION">{tr('Αποστείρωση')}</option>
              <option value="ADMIN">{tr('Διαχειριστής')}</option>
              <option value="VIEWER">{tr('Παρατηρητής (μόνο προβολή)')}</option>
            </select>
          </label>
          {role === 'VIEWER' ? (
            <div className="studio-form-note">
              <ShieldCheck size={16} />
              <span>
                {tr(
                  'Ο Παρατηρητής βλέπει όλο το νοσοκομείο (επισκόπηση, μητρώα, εκκρεμότητες, ιστορικό, αναφορές) χωρίς να μπορεί να αλλάξει τίποτα.',
                )}
              </span>
            </div>
          ) : role === 'ADMIN' ? (
            <div className="studio-form-note">
              <ShieldCheck size={16} />
              <span>
                {tr(
                  'Ο Διαχειριστής δεν ανήκει σε τμήμα: διαχειρίζεται όλο το νοσοκομείο και δημιουργεί τους χρήστες του.',
                )}
              </span>
            </div>
          ) : (
            <label>
              {tr('Τμήμα')}
              <select value={department} onChange={e => setDepartment(e.target.value)}>
                {cloudDepartments.length
                  ? cloudDepartments
                      .filter(d => d.organizationId === organizationId)
                      .map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))
                  : departments.map(d => <option key={d}>{d}</option>)}
              </select>
            </label>
          )}
          <label className="studio-switch-row">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            <span>{tr('Ενεργή πρόσβαση')}</span>
          </label>
          <label className="studio-switch-row">
            <input
              type="checkbox"
              checked={role === 'ADMIN' || demoEnabled}
              disabled={role === 'ADMIN'}
              onChange={e => setDemoEnabled(e.target.checked)}
            />
            <span>{tr('Επιτρέπεται Demo πρόσβαση')}</span>
          </label>
          <div className="studio-form-note">
            <KeyRound size={16} />
            <span>
              {tr(
                'Ο χρήστης λαμβάνει email για να ορίσει τον δικό του κωδικό. Το όνομα χρήστη δημιουργείται αυτόματα από τα αρχικά του.',
              )}
            </span>
          </div>
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton
            variant="primary"
            disabled={!name.trim() || !email.trim()}
            onClick={() =>
              onSave({
                name: name.trim(),
                email: email.trim(),
                department: role === 'ADMIN' || role === 'VIEWER' ? '' : department,
                role,
                active,
                organizationId,
                demoEnabled: role === 'ADMIN' ? true : demoEnabled,
              })
            }
          >
            {tr('Αποθήκευση')}
          </AppButton>
        </footer>
      </aside>
    </div>
  );
}
