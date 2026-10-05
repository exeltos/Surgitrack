import {useCallback, useState} from 'react';
import {useAppPreferences} from '../../../core/AppPreferences';
import {getRealIdentity} from '../../../data/cloud/identity';
import {getRuntimeDataMode} from '../../../config/dataMode';
import {useLibraries} from '../../../core/LibraryStore';
import type {Department, Request, Member, Decision, CsvRow} from '../hospitalPeopleMeta';

export function usePeopleState(props: {
  organizationId?: string;
  /** The platform owner: may also give Demo access. */
  platform?: boolean;
  /** The hospital opens Demo, so its users may get Demo access. */
  hospitalDemo?: boolean;
  refreshKey?: number;
  onChanged?: () => void;
}) {
  const {organizationId, platform, hospitalDemo, refreshKey, onChanged} = props;

  const {lang} = useAppPreferences();
  const el = lang === 'el';
  const L = (gr: string, en: string) => (el ? gr : en);
  const demo = getRuntimeDataMode() === 'DEMO';
  const libs = useLibraries();
  const me = getRealIdentity();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [newDepartment, setNewDepartment] = useState({name: '', code: ''});
  const [editing, setEditing] = useState<{id: string; name: string; code: string} | null>(null);
  /** A message over the list; `link` is one to pass on by hand when the email did not go out. */
  const [notice, setNotice] = useState<{kind: 'ok' | 'warn' | 'error'; text: string; link?: string} | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'USERS' | 'DEPARTMENTS'>('USERS');
  const [query, setQuery] = useState('');
  const [inviteMenu, setInviteMenu] = useState(false);
  const [drawer, setDrawer] = useState<{member: Member | null} | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null);
  /** Invitations sent and not accepted yet, by email: when each was last sent. */
  const [invitations, setInvitations] = useState<Record<string, string>>({});

  const showError = useCallback((text: string) => setNotice({kind: 'error', text}), []);
  const fail = (e: {message?: string} | null | undefined) => {
    if (e) setNotice({kind: 'error', text: e.message || String(e)});
    return !!e;
  };
  return {
    L,
    busy,
    csvRows,
    decisions,
    demo,
    departments,
    drawer,
    editing,
    el,
    fail,
    hospitalDemo,
    invitations,
    inviteMenu,
    lang,
    libs,
    linkOpen,
    me,
    members,
    newDepartment,
    notice,
    onChanged,
    organizationId,
    platform,
    query,
    refreshKey,
    requests,
    setBusy,
    setCsvRows,
    setDecisions,
    setDepartments,
    setDrawer,
    setEditing,
    setInvitations,
    setInviteMenu,
    setLinkOpen,
    setMembers,
    setNewDepartment,
    setNotice,
    setQuery,
    setRequests,
    setTab,
    showError,
    tab,
  };
}
