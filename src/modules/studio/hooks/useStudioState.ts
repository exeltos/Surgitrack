import {useState} from 'react';
import {useAppPreferences} from '../../../core/AppPreferences';
import {useLibraries, type LibraryKey, type AdminUser, type Organization} from '../../../core/LibraryStore';
import type {LibraryItem} from '../../../core/libraries';
import type {UserRole} from '../../../store/types';
import {useSurgi} from '../../../store/SurgiStore';
import {defaultRolePermissions, type Permission} from '../../../core/permissions';
import {actingAsPlatformOwner} from '../../../data/cloud/identity';
import {libraryMeta} from '../studioMeta';
import type {Tab} from '../studioMeta';

export function useStudioState() {
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
  const [organizationEditor, setOrganizationEditor] = useState<Organization | null | undefined>(undefined);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [cloudOrganizations, setCloudOrganizations] = useState<Organization[]>([]);
  const [cloudError, setCloudError] = useState('');
  const [cloudUsers, setCloudUsers] = useState<AdminUser[]>([]);
  const [cloudDepartments, setCloudDepartments] = useState<
    Array<{id: string; organizationId: string; name: string; code: string; active: boolean}>
  >([]);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    action: () => void;
    confirmLabel?: string;
    danger?: boolean;
    /** Typed to enable the button, for what cannot be undone. */
    confirmText?: string;
  } | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('STERILIZATION');
  const [roleDraft, setRoleDraft] = useState<Permission[]>(() => [
    ...(libs.rolePermissions?.STERILIZATION || defaultRolePermissions.STERILIZATION),
  ]);

  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  return {
    L,
    cloudDepartments,
    cloudError,
    cloudOrganizations,
    cloudUsers,
    confirm,
    currentUser,
    editItem,
    hospitalLibraryMeta,
    lang,
    libraryKey,
    libs,
    newItem,
    organizationEditor,
    platformAdmin,
    query,
    roleDraft,
    selectedOrganizationId,
    selectedRole,
    setCloudDepartments,
    setCloudError,
    setCloudOrganizations,
    setCloudUsers,
    setConfirm,
    setEditItem,
    setLibraryKey,
    setNewItem,
    setOrganizationEditor,
    setQuery,
    setRole,
    setRoleDraft,
    setSelectedOrganizationId,
    setSelectedRole,
    setTab,
    setTapesOpen,
    tab,
    tapesOpen,
  };
}
