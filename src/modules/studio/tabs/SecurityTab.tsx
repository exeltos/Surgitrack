import {useCallback, useEffect, useMemo, useState} from 'react';
import {Ban, RefreshCw, ShieldCheck, UserX} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import Spinner from '../../../components/ui/Spinner';
import {askConfirm} from '../../../components/ui/confirmService';
import {formatDateTime} from '../../../core/displayDate';
import {supabase} from '../../../lib/supabase';
import {browserOf, sinceLabel, type ActiveSession} from '../securitySessions';
import type {StudioPageState} from '../useStudioPage';

type Blocked = {ip: string; note: string | null; blocked_at: string};

/** How often the list of who is connected renews itself while this section is open. */
const REFRESH = 15_000;

/**
 * The platform owner's security view: the people connected right now with the address each comes from, who can be
 * blocked (their address, or the person), and the addresses already blocked.
 */
export default function SecurityTab({s}: {s: StudioPageState}) {
  const {L, platformAdmin, tab} = s;
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [failed, setFailed] = useState('');
  const [adding, setAdding] = useState('');
  const [note, setNote] = useState('');
  const open = tab === 'SECURITY' && platformAdmin;

  const load = useCallback(async () => {
    const [list, ips] = await Promise.all([
      supabase.rpc('platform_active_sessions', {p_minutes: 5}),
      supabase.from('blocked_ips').select('ip,note,blocked_at').order('blocked_at', {ascending: false}),
    ]);
    setFailed(list.error?.message || ips.error?.message || '');
    setSessions((list.data as ActiveSession[] | null) || []);
    setBlocked((ips.data as Blocked[] | null) || []);
  }, []);
  useEffect(() => {
    if (!open) return;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH);
    return () => window.clearInterval(timer);
  }, [open, load]);

  // Everyone from one address (a hospital's network is often a single address).
  const perIp = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of sessions || []) if (row.ip) counts.set(row.ip, (counts.get(row.ip) || 0) + 1);
    return counts;
  }, [sessions]);

  if (!open) return null;

  const blockIp = async (ip: string, why = '') => {
    const people = perIp.get(ip) || 0;
    const sure = await askConfirm({
      title: L('Μπλοκάρισμα διεύθυνσης', 'Block address'),
      message: L(
        `Η διεύθυνση ${ip} δεν θα έχει πρόσβαση σε κανένα νοσοκομείο, και όσοι είναι τώρα εκεί θα αποκλειστούν σε ένα λεπτό.${people > 1 ? ` Τώρα συνδέονται από αυτήν ${people} άτομα.` : ''} Εσείς δεν μπλοκάρεστε ποτέ.`,
        `Address ${ip} will have no access to any hospital, and whoever is on it is cut off within a minute.${people > 1 ? ` ${people} people are connected from it now.` : ''} You are never blocked.`,
      ),
      confirmLabel: L('Μπλοκάρισμα', 'Block'),
      danger: true,
    });
    if (sure === false) return;
    const {error} = await supabase.rpc('platform_block_ip', {p_ip: ip, p_note: why || null});
    setFailed(error ? error.message : '');
    await load();
  };
  const unblock = async (ip: string) => {
    const {error} = await supabase.rpc('platform_unblock_ip', {p_ip: ip});
    setFailed(error ? error.message : '');
    await load();
  };
  const suspend = async (row: ActiveSession) => {
    const sure = await askConfirm({
      title: L('Αναστολή χρήστη', 'Suspend user'),
      message: L(
        `Ο ${row.name} δεν θα μπορεί να δουλέψει ως την επανενεργοποίησή του (Χρήστες).`,
        `${row.name} cannot work until reactivated (Users).`,
      ),
      confirmLabel: L('Αναστολή', 'Suspend'),
      danger: true,
    });
    if (sure === false) return;
    // The access function sets the demo flag as well: keep the person's own.
    const {data: profile} = await supabase.from('profiles').select('demo_enabled').eq('id', row.user_id).maybeSingle();
    const {error} = await supabase.rpc('platform_set_profile_access', {
      p_id: row.user_id,
      p_active: false,
      p_demo_enabled: !!(profile as {demo_enabled?: boolean} | null)?.demo_enabled,
    });
    setFailed(error ? error.message : '');
    await load();
  };
  const addIp = async () => {
    const ip = adding.trim();
    if (!ip) return;
    await blockIp(ip, note.trim());
    setAdding('');
    setNote('');
  };

  return (
    <section className="studio-errors studio-security">
      {failed && <p className="studio-errors-failed">{failed}</p>}
      <div className="studio-security-title">
        <h3>
          {L('Συνδεδεμένοι τώρα', 'Connected now')}
          {sessions ? ` · ${sessions.length}` : ''}
        </h3>
        <small>{L('Ανανεώνεται κάθε 15 δευτερόλεπτα', 'Renews every 15 seconds')}</small>
        <AppButton icon={<RefreshCw size={16} />} onClick={() => void load()}>
          {L('Ανανέωση', 'Refresh')}
        </AppButton>
      </div>
      {sessions === null ? (
        <Spinner />
      ) : !sessions.length ? (
        <p className="studio-security-empty">
          <ShieldCheck size={18} aria-hidden="true" />
          {L(
            'Κανείς δεν έχει ανοιχτή την εφαρμογή αυτή τη στιγμή (τελευταία 5 λεπτά).',
            'Nobody has the app open right now (last 5 minutes).',
          )}
        </p>
      ) : (
        <div className="studio-security-scroll">
          <table className="studio-security-table">
            <thead>
              <tr>
                <th>{L('Χρήστης', 'User')}</th>
                <th>{L('Νοσοκομείο', 'Hospital')}</th>
                <th>{L('Διεύθυνση', 'Address')}</th>
                <th>{L('Πρόγραμμα περιήγησης', 'Browser')}</th>
                <th>{L('Από', 'Since')}</th>
                <th>{L('Τελευταία δραστηριότητα', 'Last seen')}</th>
                <th aria-label={L('Ενέργειες', 'Actions')} />
              </tr>
            </thead>
            <tbody>
              {sessions.map(row => (
                <tr key={row.user_id} className={row.ip_blocked ? 'blocked' : ''}>
                  <td>
                    <b>{row.name}</b>
                    <small>{row.email}</small>
                  </td>
                  <td>{row.organization_name || L('Πλατφόρμα', 'Platform')}</td>
                  <td>
                    <b className="mono">{row.ip || '—'}</b>
                    {row.ip && (perIp.get(row.ip) || 0) > 1 && (
                      <small>{L(`${perIp.get(row.ip)} άτομα`, `${perIp.get(row.ip)} people`)}</small>
                    )}
                    {row.ip_blocked && <small className="studio-security-flag">{L('Μπλοκαρισμένη', 'Blocked')}</small>}
                  </td>
                  <td>{browserOf(row.user_agent)}</td>
                  <td>{formatDateTime(row.first_seen)}</td>
                  <td>{sinceLabel(row.last_seen, Date.now(), L)}</td>
                  <td>
                    <div className="studio-security-actions">
                      {row.ip && !row.ip_blocked && (
                        <AppButton variant="danger" icon={<Ban size={15} />} onClick={() => void blockIp(row.ip!)}>
                          {L('Μπλοκάρισμα IP', 'Block IP')}
                        </AppButton>
                      )}
                      {row.organization_id && row.active && (
                        <AppButton icon={<UserX size={15} />} onClick={() => void suspend(row)}>
                          {L('Αναστολή χρήστη', 'Suspend user')}
                        </AppButton>
                      )}
                      {row.organization_id && !row.active && (
                        <small className="studio-security-flag">{L('Σε αναστολή', 'Suspended')}</small>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="studio-security-title">
        <h3>
          {L('Μπλοκαρισμένες διευθύνσεις', 'Blocked addresses')} · {blocked.length}
        </h3>
      </div>
      <div className="studio-security-add">
        <input
          aria-label={L('Διεύθυνση ή μικρό εύρος', 'Address or small range')}
          value={adding}
          onChange={e => setAdding(e.target.value)}
          placeholder={L('Διεύθυνση, π.χ. 203.0.113.5 ή 203.0.113.0/28', 'Address, e.g. 203.0.113.5 or 203.0.113.0/28')}
        />
        <input
          aria-label={L('Σημείωση', 'Note')}
          value={note}
          maxLength={200}
          onChange={e => setNote(e.target.value)}
          placeholder={L('Σημείωση (προαιρετικά)', 'Note (optional)')}
        />
        <AppButton variant="danger" icon={<Ban size={15} />} disabled={!adding.trim()} onClick={() => void addIp()}>
          {L('Μπλοκάρισμα', 'Block')}
        </AppButton>
      </div>
      {blocked.length > 0 && (
        <ul className="studio-errors-list studio-security-blocked">
          {blocked.map(row => (
            <li key={row.ip}>
              <span>
                <b className="mono">{row.ip.replace(/\/(32|128)$/, '')}</b>
                {row.note && <small>{row.note}</small>}
                <small>{formatDateTime(row.blocked_at)}</small>
              </span>
              <AppButton onClick={() => void unblock(row.ip)}>{L('Ξεμπλοκάρισμα', 'Unblock')}</AppButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
