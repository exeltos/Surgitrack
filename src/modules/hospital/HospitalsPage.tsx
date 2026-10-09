import {useCallback, useEffect, useMemo, useState} from 'react';
import {Check, LogIn, LogOut, Pencil, Plus, RefreshCw, Search, X} from 'lucide-react';
import {Navigate} from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import AppButton from '../../components/ui/AppButton';
import {supabase} from '../../lib/supabase';
import {useAppPreferences} from '../../core/AppPreferences';
import {actingAsPlatformOwner} from '../../data/cloud/identity';
import {activeHospitalId, switchHospital} from '../../data/cloud/hospitalSwitch';
import Spinner from '../../components/ui/Spinner';
import {formatDate} from '../../core/displayDate';

type Hospital = {id: string; name: string; code: string; active: boolean; demo_enabled: boolean};
type Stats = {departments: number; users: number; activeUsers: number; pending: number; linkUntil?: string};
type Draft = {id?: string; name: string; code: string};

const tally = (rows: Array<{organization_id: string | null}> | null) => {
  const out = new Map<string, number>();
  (rows || []).forEach(r => r.organization_id && out.set(r.organization_id, (out.get(r.organization_id) || 0) + 1));
  return out;
};

/**
 * Every real hospital for the platform admin: its numbers at a glance, quick edits, and
 * "Enter" to work inside that hospital with its own data.
 */
export default function HospitalsPage() {
  const {lang} = useAppPreferences();
  const el = lang === 'el';
  const L = (gr: string, en: string) => (el ? gr : en);
  const platform = actingAsPlatformOwner();
  const current = activeHospitalId();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date().toISOString();
    const [orgs, deps, users, requests, links] = await Promise.all([
      supabase.from('organizations').select('id,name,code,active,demo_enabled').eq('is_demo', false).order('name'),
      supabase.rpc('platform_list_departments'),
      supabase.from('profiles').select('organization_id,active').not('organization_id', 'is', null),
      supabase.from('staff_access_requests').select('organization_id').eq('status', 'PENDING'),
      supabase.from('signup_links').select('organization_id,expires_at').is('revoked_at', null).gt('expires_at', now),
    ]);
    const failed = orgs.error || deps.error || users.error || requests.error || links.error;
    setError(failed ? failed.message : '');
    if (orgs.data) setHospitals(orgs.data as Hospital[]);
    const departments = tally(deps.data as Array<{organization_id: string}> | null);
    const allUsers = tally(users.data);
    const activeUsers = tally((users.data || []).filter(u => u.active));
    const pending = tally(requests.data);
    const next: Record<string, Stats> = {};
    (orgs.data || []).forEach(o => {
      const link = (links.data || [])
        .filter(l => l.organization_id === o.id)
        .sort((a, b) => b.expires_at.localeCompare(a.expires_at))[0];
      next[o.id] = {
        departments: departments.get(o.id) || 0,
        users: allUsers.get(o.id) || 0,
        activeUsers: activeUsers.get(o.id) || 0,
        pending: pending.get(o.id) || 0,
        linkUntil: link?.expires_at,
      };
    });
    setStats(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (platform) void load();
  }, [platform, load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return hospitals.filter(h => !q || `${h.name} ${h.code}`.toLowerCase().includes(q));
  }, [hospitals, query]);

  if (!platform) return <Navigate to="/hospital" replace />;

  const save = async () => {
    if (!draft?.name.trim() || !draft.code.trim()) return;
    const name = draft.name.trim();
    const code = draft.code.trim().toUpperCase();
    const existing = hospitals.find(h => h.id === draft.id);
    const {error: saveError} = existing
      ? await supabase.rpc('platform_update_organization', {
          p_id: existing.id,
          p_name: name,
          p_code: code,
          p_active: existing.active,
          p_demo_enabled: existing.demo_enabled,
        })
      : await supabase.rpc('platform_create_organization', {p_name: name, p_code: code});
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setDraft(null);
    await load();
  };
  const toggleActive = async (h: Hospital) => {
    if (
      h.active &&
      !window.confirm(
        L(
          `Απενεργοποίηση του ${h.name}; Οι χρήστες του δεν θα μπορούν να εργαστούν.`,
          `Deactivate ${h.name}? Its users will not be able to work.`,
        ),
      )
    )
      return;
    const {error: toggleError} = await supabase.rpc('platform_update_organization', {
      p_id: h.id,
      p_name: h.name,
      p_code: h.code,
      p_active: !h.active,
      p_demo_enabled: h.demo_enabled,
    });
    if (toggleError) setError(toggleError.message);
    else await load();
  };
  const date = (iso: string) => formatDate(iso);
  const currentHospital = hospitals.find(h => h.id === current);

  return (
    <div className="hospitals-page">
      <PageHeader
        eyebrow={L('ΔΙΑΧΕΙΡΙΣΗ ΠΛΑΤΦΟΡΜΑΣ', 'PLATFORM ADMINISTRATION')}
        title={L('Νοσοκομεία', 'Hospitals')}
        description={L(
          'Όλα τα νοσοκομεία της πλατφόρμας. Πατήστε «Είσοδος» για να εργαστείτε σε ένα.',
          'Every hospital on the platform. Press "Enter" to work inside one.',
        )}
        actions={
          <div className="hospitals-actions">
            <AppButton onClick={() => void load()} icon={<RefreshCw size={15} />}>
              {L('Ανανέωση', 'Refresh')}
            </AppButton>
            <AppButton variant="primary" onClick={() => setDraft({name: '', code: ''})} icon={<Plus size={15} />}>
              {L('Νέο νοσοκομείο', 'New hospital')}
            </AppButton>
          </div>
        }
      />
      {currentHospital && (
        <div className="hospitals-current">
          <span>
            {L('Εργάζεστε τώρα στο', 'You are working in')} <b>{currentHospital.name}</b>
          </span>
          <AppButton size="sm" onClick={() => switchHospital('')} icon={<LogOut size={14} />}>
            {L('Έξοδος στο Studio', 'Leave to Studio')}
          </AppButton>
        </div>
      )}
      {error && (
        <div className="hospital-notice error" role="status">
          {error}
          <button onClick={() => setError('')} aria-label={L('Κλείσιμο', 'Close')}>
            <X size={14} />
          </button>
        </div>
      )}
      <section className="hospital-card hospitals-list">
        <div className="hospitals-toolbar">
          <div className="studio-search">
            <Search size={17} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={L('Αναζήτηση νοσοκομείου ή κωδικού...', 'Search hospital or code...')}
            />
          </div>
          <span className="hospital-count">{hospitals.length}</span>
        </div>
        {draft && !draft.id && (
          <div className="hospitals-row editing">
            <input
              autoFocus
              value={draft.name}
              onChange={e => setDraft({...draft, name: e.target.value})}
              placeholder={L('Όνομα νοσοκομείου', 'Hospital name')}
            />
            <input
              value={draft.code}
              onChange={e => setDraft({...draft, code: e.target.value})}
              placeholder={L('Κωδικός', 'Code')}
            />
            <AppButton
              variant="primary"
              disabled={!draft.name.trim() || !draft.code.trim()}
              onClick={() => void save()}
              icon={<Check size={14} />}
            >
              {L('Δημιουργία', 'Create')}
            </AppButton>
            <AppButton variant="ghost" onClick={() => setDraft(null)} icon={<X size={14} />}>
              {L('Ακύρωση', 'Cancel')}
            </AppButton>
          </div>
        )}
        <div className="hospitals-head">
          <span>{L('Νοσοκομείο', 'Hospital')}</span>
          <span>{L('Τμήματα', 'Departments')}</span>
          <span>{L('Χρήστες', 'Users')}</span>
          <span>{L('Αιτήματα', 'Requests')}</span>
          <span>{L('Σύνδεσμος εγγραφής', 'Signup link')}</span>
          <span>{L('Κατάσταση', 'Status')}</span>
          <span></span>
        </div>
        {loading && <Spinner />}
        {!loading && shown.length === 0 && (
          <p className="hospital-empty hospitals-empty">
            {query
              ? L('Κανένα νοσοκομείο δεν ταιριάζει.', 'No hospital matches.')
              : L('Δεν υπάρχουν νοσοκομεία ακόμα.', 'No hospitals yet.')}
          </p>
        )}
        {shown.map(h => {
          const s = stats[h.id];
          if (draft?.id === h.id)
            return (
              <div key={h.id} className="hospitals-row editing">
                <input autoFocus value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} />
                <input value={draft.code} onChange={e => setDraft({...draft, code: e.target.value})} />
                <AppButton variant="primary" onClick={() => void save()} icon={<Check size={14} />}>
                  {L('Αποθήκευση', 'Save')}
                </AppButton>
                <AppButton variant="ghost" onClick={() => setDraft(null)} icon={<X size={14} />}>
                  {L('Ακύρωση', 'Cancel')}
                </AppButton>
              </div>
            );
          return (
            <div
              key={h.id}
              className={`hospitals-row ${h.id === current ? 'current' : ''} ${h.active ? '' : 'inactive'}`}
            >
              <span className="hospitals-name">
                <b>{h.name}</b>
                <small>{h.code}</small>
              </span>
              <span>{s?.departments ?? '—'}</span>
              <span>{s ? `${s.activeUsers} / ${s.users}` : '—'}</span>
              <span>{s?.pending ? <em className="hospitals-badge">{s.pending}</em> : '0'}</span>
              <span className="hospitals-link">
                {s?.linkUntil ? L(`Ενεργός έως ${date(s.linkUntil)}`, `Active until ${date(s.linkUntil)}`) : '—'}
              </span>
              <button
                className={`studio-access-toggle ${h.active ? 'active' : ''}`}
                onClick={() => void toggleActive(h)}
              >
                <span></span>
                {h.active ? L('Ενεργό', 'Active') : L('Ανενεργό', 'Inactive')}
              </button>
              <span className="hospitals-row-actions">
                <button
                  className="hospitals-icon"
                  onClick={() => setDraft({id: h.id, name: h.name, code: h.code})}
                  aria-label={L('Επεξεργασία', 'Edit')}
                  title={L('Επεξεργασία', 'Edit')}
                >
                  <Pencil size={14} />
                </button>
                {h.id === current ? (
                  <span className="hospitals-here">{L('Εδώ εργάζεστε', 'Working here')}</span>
                ) : (
                  <AppButton
                    size="sm"
                    variant="primary"
                    disabled={!h.active}
                    onClick={() => switchHospital(h.id)}
                    icon={<LogIn size={14} />}
                  >
                    {L('Είσοδος', 'Enter')}
                  </AppButton>
                )}
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}
