import {useEffect, useState} from 'react';
import {X} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {supabase} from '../../lib/supabase';
import {getI18nLang} from '../../i18n';
import {checkIpAccess} from '../../data/cloud/ipAccess';
import {plainAddress} from '../../core/ipAddress';
import type {Organization} from '../../core/LibraryStore';

type Mode = 'OFF' | 'LOG' | 'ENFORCE';
type Address = {ip: string; label: string};
type Member = {id: string; name: string; role: string; active: boolean};
type LogRow = {id: number; user_id: string; ip: string | null; blocked: boolean; at: string};

/**
 * The platform owner's rule for one hospital's networks: the mode, the allowed addresses and the people who may work
 * from anywhere. The owner is never held to it.
 */
export default function NetworkAccessDialog({
  organization,
  onClose,
}: {
  organization: Organization;
  onClose: () => void;
}) {
  const L = (el: string, en: string) => (getI18nLang() === 'el' ? el : en);
  const [mode, setMode] = useState<Mode>('OFF');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [exempt, setExempt] = useState<string[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [myIp, setMyIp] = useState<string>();
  const [find, setFind] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'saving'>('loading');
  const [editing, setEditing] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [rule, people, rows, mine] = await Promise.all([
        supabase
          .from('ip_access')
          .select('mode,addresses,exempt_users')
          .eq('organization_id', organization.id)
          .maybeSingle(),
        supabase.from('profiles').select('id,name,role,active').eq('organization_id', organization.id).order('name'),
        supabase
          .from('ip_access_log')
          .select('id,user_id,ip,blocked,at')
          .eq('organization_id', organization.id)
          .order('at', {ascending: false})
          .limit(30),
        checkIpAccess(),
      ]);
      if (!alive) return;
      const row = rule.data as {mode?: Mode; addresses?: Address[]; exempt_users?: string[]} | null;
      setMode(row?.mode || 'OFF');
      setAddresses((row?.addresses || []).map(a => ({ip: plainAddress(a.ip), label: a.label || ''})));
      setExempt(row?.exempt_users || []);
      setMembers((people.data as Member[] | null) || []);
      setLog((rows.data as LogRow[] | null) || []);
      setMyIp(mine?.ip);
      setState('ready');
    })();
    return () => {
      alive = false;
    };
  }, [organization.id, reload]);

  const nameOf = (id: string) => members.find(m => m.id === id)?.name || '—';
  const shown = members.filter(m => m.name.toLowerCase().includes(find.trim().toLowerCase()));
  const toggle = (id: string) => setExempt(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]));
  const setAddress = (index: number, patch: Partial<Address>) =>
    setAddresses(list => list.map((a, i) => (i === index ? {...a, ...patch} : a)));
  const filled = addresses.filter(a => a.ip.trim());

  const save = async () => {
    setState('saving');
    setError('');
    const {error: failed} = await supabase.rpc('platform_set_ip_access', {
      p_org: organization.id,
      p_mode: mode,
      p_addresses: filled.map(a => ({ip: a.ip.trim(), label: a.label.trim()})),
      p_exempt: exempt,
    });
    if (failed) {
      setError(
        /not an address/.test(failed.message)
          ? L(
              'Κάποια διεύθυνση δεν είναι έγκυρη (π.χ. 203.0.113.5 ή 203.0.113.0/28).',
              'An address is not valid (e.g. 203.0.113.5 or 203.0.113.0/28).',
            )
          : /at least one address/.test(failed.message)
            ? L(
                'Για να ενεργοποιηθεί ο περιορισμός χρειάζεται τουλάχιστον μία διεύθυνση.',
                'At least one address is needed to enforce it.',
              )
            : failed.message,
      );
      setState('ready');
      return;
    }
    setEditing(false);
    setState('loading');
    setReload(n => n + 1);
  };

  const modes: {value: Mode; label: string; hint: string}[] = [
    {
      value: 'OFF',
      label: L('Ανενεργός', 'Off'),
      hint: L('Όλοι μπαίνουν από παντού.', 'Everyone gets in from anywhere.'),
    },
    {
      value: 'LOG',
      label: L('Μόνο καταγραφή', 'Record only'),
      hint: L(
        'Δεν μπλοκάρει κανέναν· γράφει ποιος θα είχε μπλοκαριστεί. Δοκιμάστε το πρώτα.',
        'Blocks nobody; records who would have been blocked. Try it first.',
      ),
    },
    {
      value: 'ENFORCE',
      label: L('Ενεργός', 'On'),
      hint: L('Μπαίνουν μόνο από τις διευθύνσεις παρακάτω.', 'Only the addresses below get in.'),
    },
  ];

  return (
    <div className="studio-drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <aside className="studio-drawer network-access">
        <header>
          <div>
            <span className="eyebrow">{organization.name}</span>
            <h2>{L('Πρόσβαση ανά δίκτυο', 'Access by network')}</h2>
          </div>
        </header>
        <div className="studio-drawer-form">
          <small className="studio-field-hint">
            {L('Ο owner μπαίνει πάντα από παντού.', 'The owner always gets in from anywhere.')}
          </small>
          <fieldset className="studio-plan">
            <legend>{L('Λειτουργία', 'Mode')}</legend>
            {modes.map(m => (
              <label key={m.value} className="network-mode">
                <input
                  type="radio"
                  name="ip-mode"
                  disabled={!editing}
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                />
                <span>
                  <b>{m.label}</b>
                  <small>{m.hint}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="studio-plan">
            <legend>{L('Επιτρεπτές διευθύνσεις', 'Allowed addresses')}</legend>
            {addresses.map((a, i) => (
              <div className={`network-address ${editing ? 'editing' : ''}`} key={i}>
                <input
                  value={a.ip}
                  disabled={!editing}
                  placeholder="203.0.113.5"
                  aria-label={L('Διεύθυνση IP', 'IP address')}
                  onChange={e => setAddress(i, {ip: e.target.value})}
                />
                <input
                  value={a.label}
                  disabled={!editing}
                  placeholder={L('Περιγραφή (π.χ. Wi-Fi)', 'Label (e.g. Wi-Fi)')}
                  aria-label={L('Περιγραφή', 'Label')}
                  onChange={e => setAddress(i, {label: e.target.value})}
                />
                {editing && (
                  <button
                    type="button"
                    className="network-remove"
                    aria-label={L('Αφαίρεση', 'Remove')}
                    onClick={() => setAddresses(list => list.filter((_, j) => j !== i))}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            {!addresses.length && !editing && <small>{L('Καμία διεύθυνση.', 'No address.')}</small>}
            {editing && (
              <div className="network-add">
                <AppButton onClick={() => setAddresses(list => [...list, {ip: '', label: ''}])}>
                  {L('Προσθήκη διεύθυνσης', 'Add an address')}
                </AppButton>
                {myIp && !addresses.some(a => a.ip.trim() === myIp) && (
                  <AppButton onClick={() => setAddresses(list => [...list, {ip: myIp, label: L('Η IP μου', 'My IP')}])}>
                    {L(`Προσθήκη της IP μου (${myIp})`, `Add my IP (${myIp})`)}
                  </AppButton>
                )}
              </div>
            )}
          </fieldset>

          <fieldset className="studio-plan">
            <legend>{L('Εξαιρέσεις', 'Exceptions')}</legend>
            {editing && (
              <input
                value={find}
                placeholder={L('Αναζήτηση χρήστη…', 'Search a user…')}
                aria-label={L('Αναζήτηση χρήστη', 'Search a user')}
                onChange={e => setFind(e.target.value)}
              />
            )}
            <div className="network-people">
              {(editing ? shown : members.filter(m => exempt.includes(m.id))).map(m => (
                <label key={m.id}>
                  <input
                    type="checkbox"
                    disabled={!editing}
                    checked={exempt.includes(m.id)}
                    onChange={() => toggle(m.id)}
                  />
                  <span>
                    {m.name}
                    <small>
                      {m.role}
                      {m.active ? '' : ` · ${L('ανενεργός', 'inactive')}`}
                    </small>
                  </span>
                </label>
              ))}
              {state === 'ready' && !editing && !exempt.length && (
                <small>
                  {L(
                    'Καμία εξαίρεση. Μπαίνει μόνο ο owner από παντού.',
                    'No exceptions. Only the owner gets in from anywhere.',
                  )}
                </small>
              )}
            </div>
          </fieldset>

          <fieldset className="studio-plan">
            <legend>{L('Προσπάθειες από άλλη διεύθυνση', 'Attempts from another address')}</legend>
            {log.length ? (
              <table className="network-log">
                <tbody>
                  {log.map(r => (
                    <tr key={r.id}>
                      <td>{new Date(r.at).toLocaleString(getI18nLang() === 'el' ? 'el-GR' : 'en-GB')}</td>
                      <td>{nameOf(r.user_id)}</td>
                      <td>{r.ip}</td>
                      <td>{r.blocked ? L('μπλοκαρίστηκε', 'blocked') : L('θα μπλοκαριζόταν', 'would be blocked')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <small>{L('Καμία ακόμη.', 'None yet.')}</small>
            )}
          </fieldset>
          {error && <small className="studio-field-error">{error}</small>}
        </div>
        <footer>
          {editing ? (
            <>
              <AppButton
                onClick={() => {
                  setEditing(false);
                  setError('');
                  setState('loading');
                  setReload(n => n + 1);
                }}
              >
                {L('Ακύρωση', 'Cancel')}
              </AppButton>
              <AppButton variant="primary" disabled={state !== 'ready'} onClick={() => void save()}>
                {L('Αποθήκευση', 'Save')}
              </AppButton>
            </>
          ) : (
            <>
              <AppButton onClick={onClose}>{L('Κλείσιμο', 'Close')}</AppButton>
              <AppButton variant="primary" disabled={state !== 'ready'} onClick={() => setEditing(true)}>
                {L('Επεξεργασία', 'Edit')}
              </AppButton>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}
