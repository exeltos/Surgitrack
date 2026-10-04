import {useEffect, useMemo, useState} from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ChevronRight,
  Clock,
  Lock,
  Mail,
  Plus,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {supabase} from '../../lib/supabase';
import {trialState} from '../../core/trial';
import type {AdminUser, Organization} from '../../core/libraryTypes';

type Pending = {organization_id: string};
type Invitation = {organization_id: string; email: string; full_name: string; last_sent_at: string | null};
type Attention = {
  key: string;
  tone: 'stop' | 'warn' | 'info';
  icon: typeof Lock;
  text: string;
  action: string;
  run: () => void;
};

const TRIAL_EXTENSION_DAYS = 30;

/**
 * The platform owner's start page: how the hospitals are doing, what needs the owner now (trials
 * ending or ended, signups to approve, hospitals without an admin, invitations not accepted) and
 * every hospital with its plan and users, each one a click from its users or its card.
 */
export default function OwnerDashboard({
  organizations,
  users,
  production,
  L,
  onOpenUsers,
  onOpenHospitals,
  onNewHospital,
  onExtendTrial,
  onMakeStandard,
}: {
  organizations: Organization[];
  users: AdminUser[];
  production: boolean;
  L: (el: string, en: string) => string;
  onOpenUsers: (organizationId: string) => void;
  onOpenHospitals: () => void;
  onNewHospital: () => void;
  onExtendTrial: (org: Organization, endsAt: string) => void;
  onMakeStandard: (org: Organization) => void;
}) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  useEffect(() => {
    if (!production) return;
    void supabase
      .from('staff_access_requests')
      .select('organization_id')
      .eq('status', 'PENDING')
      .then(({data}) => setPending((data as Pending[]) || []));
    void supabase
      .from('user_invitations')
      .select('organization_id,email,full_name,last_sent_at')
      .eq('status', 'SENT')
      .then(({data}) => setInvitations((data as Invitation[]) || []));
  }, [production]);

  const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('el-GR') : '—');
  const rows = useMemo(
    () =>
      organizations.map(org => {
        const people = users.filter(u => u.organizationId === org.id);
        // Invitations sent but never accepted: the account exists and stays inactive until then.
        const waiting = invitations.filter(
          i => i.organization_id === org.id && people.some(u => !u.active && u.email.toLowerCase() === i.email),
        );
        return {
          org,
          trial: trialState(org.plan, org.trialEndsAt),
          users: people.length,
          active: people.filter(u => u.active).length,
          admins: people.filter(u => u.role === 'ADMIN' && u.active).length,
          requests: pending.filter(p => p.organization_id === org.id).length,
          waiting,
        };
      }),
    [organizations, users, pending, invitations],
  );

  const activeHospitals = rows.filter(r => r.org.active && !r.trial.ended);
  const trials = rows.filter(r => r.trial.plan === 'TRIAL' && !r.trial.ended);
  const ending = trials.filter(r => r.trial.warn);
  const locked = rows.filter(r => r.trial.ended);
  const requests = rows.reduce((sum, r) => sum + r.requests, 0);
  const activeUsers = rows.reduce((sum, r) => sum + r.active, 0);
  const extendFrom = (r: (typeof rows)[number]) => {
    // An ended trial is extended from today; a running one from its own end.
    const base = r.trial.ended || !r.trial.endsAt ? Date.now() : Date.parse(r.trial.endsAt);
    return new Date(base + TRIAL_EXTENSION_DAYS * 864e5).toISOString();
  };

  const attention: Attention[] = [
    ...locked.map(r => ({
      key: `locked-${r.org.id}`,
      tone: 'stop' as const,
      icon: Lock,
      text: L(
        `${r.org.name}: η δοκιμαστική περίοδος έληξε στις ${date(r.trial.endsAt)} και το νοσοκομείο είναι κλειδωμένο.`,
        `${r.org.name}: the trial ended on ${date(r.trial.endsAt)} and the hospital is locked.`,
      ),
      action: L(`+${TRIAL_EXTENSION_DAYS} ημέρες`, `+${TRIAL_EXTENSION_DAYS} days`),
      run: () => onExtendTrial(r.org, extendFrom(r)),
    })),
    ...ending.map(r => ({
      key: `ending-${r.org.id}`,
      tone: 'warn' as const,
      icon: CalendarClock,
      text: L(
        `${r.org.name}: η δοκιμαστική περίοδος λήγει σε ${r.trial.daysLeft} ${r.trial.daysLeft === 1 ? 'ημέρα' : 'ημέρες'} (${date(r.trial.endsAt)}).`,
        `${r.org.name}: the trial ends in ${r.trial.daysLeft} ${r.trial.daysLeft === 1 ? 'day' : 'days'} (${date(r.trial.endsAt)}).`,
      ),
      action: L(`+${TRIAL_EXTENSION_DAYS} ημέρες`, `+${TRIAL_EXTENSION_DAYS} days`),
      run: () => onExtendTrial(r.org, extendFrom(r)),
    })),
    ...rows
      .filter(r => r.requests > 0)
      .map(r => ({
        key: `requests-${r.org.id}`,
        tone: 'warn' as const,
        icon: UserCheck,
        text: L(
          `${r.org.name}: ${r.requests} ${r.requests === 1 ? 'αίτημα εγγραφής περιμένει' : 'αιτήματα εγγραφής περιμένουν'} έγκριση.`,
          `${r.org.name}: ${r.requests} signup ${r.requests === 1 ? 'request awaits' : 'requests await'} approval.`,
        ),
        action: L('Έγκριση', 'Review'),
        run: () => onOpenUsers(r.org.id),
      })),
    ...rows
      .filter(r => r.org.active && r.admins === 0)
      .map(r => ({
        key: `admin-${r.org.id}`,
        tone: 'info' as const,
        icon: UserX,
        text: L(
          `${r.org.name}: δεν έχει ενεργό Διαχειριστή νοσοκομείου${r.waiting.length ? ' (η πρόσκληση δεν έχει γίνει αποδεκτή ακόμα)' : ''}.`,
          `${r.org.name}: has no active hospital admin${r.waiting.length ? ' (the invitation is not accepted yet)' : ''}.`,
        ),
        action: L('Χρήστες', 'Users'),
        run: () => onOpenUsers(r.org.id),
      })),
    ...rows
      .filter(r => r.waiting.length > 0 && r.admins > 0)
      .map(r => ({
        key: `invites-${r.org.id}`,
        tone: 'info' as const,
        icon: Mail,
        text: L(
          `${r.org.name}: ${r.waiting.length} ${r.waiting.length === 1 ? 'πρόσκληση δεν έχει' : 'προσκλήσεις δεν έχουν'} γίνει αποδεκτή.`,
          `${r.org.name}: ${r.waiting.length} ${r.waiting.length === 1 ? 'invitation is' : 'invitations are'} not accepted yet.`,
        ),
        action: L('Χρήστες', 'Users'),
        run: () => onOpenUsers(r.org.id),
      })),
  ];

  const kpis = [
    {icon: Building2, label: L('Ενεργά νοσοκομεία', 'Active hospitals'), value: activeHospitals.length},
    {icon: Clock, label: L('Σε δοκιμαστική περίοδο', 'On trial'), value: trials.length},
    {
      icon: CalendarClock,
      label: L('Λήγουν σε 7 ημέρες', 'Ending within 7 days'),
      value: ending.length,
      tone: ending.length ? 'warn' : '',
    },
    {icon: Lock, label: L('Κλειδωμένα', 'Locked'), value: locked.length, tone: locked.length ? 'stop' : ''},
    {icon: Users, label: L('Ενεργοί χρήστες', 'Active users'), value: activeUsers},
    {
      icon: UserCheck,
      label: L('Αιτήματα σε αναμονή', 'Requests waiting'),
      value: requests,
      tone: requests ? 'warn' : '',
    },
  ];

  return (
    <div className="owner-dashboard">
      <div className="owner-kpis">
        {kpis.map(k => (
          <div key={k.label} className={`owner-kpi ${k.tone || ''}`}>
            <k.icon size={18} />
            <span>{k.label}</span>
            <strong>{k.value}</strong>
          </div>
        ))}
      </div>

      <div className="owner-grid">
        <section className="owner-card">
          <header>
            <div>
              <span className="eyebrow">{L('ΣΗΜΕΡΑ', 'TODAY')}</span>
              <h2>{L('Χρειάζονται προσοχή', 'Needs attention')}</h2>
            </div>
            <span className={`owner-count ${attention.length ? 'warn' : ''}`}>{attention.length}</span>
          </header>
          {attention.length === 0 ? (
            <p className="owner-empty">
              <UserCheck size={18} />
              {L('Όλα εντάξει. Τίποτα δεν περιμένει από εσάς.', 'All good. Nothing is waiting for you.')}
            </p>
          ) : (
            <ul className="owner-attention">
              {attention.map(a => (
                <li key={a.key} className={a.tone}>
                  <a.icon size={17} />
                  <span>{a.text}</span>
                  <AppButton size="sm" onClick={a.run}>
                    {a.action}
                  </AppButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="owner-card">
          <header>
            <div>
              <span className="eyebrow">{L('ΓΡΗΓΟΡΑ', 'QUICK')}</span>
              <h2>{L('Ενέργειες', 'Actions')}</h2>
            </div>
          </header>
          <div className="owner-actions">
            <button onClick={onNewHospital}>
              <Plus size={18} />
              <span>
                <b>{L('Νέο νοσοκομείο', 'New hospital')}</b>
                <small>{L('Κανονική χρήση ή δοκιμαστική περίοδος', 'Standard use or a trial')}</small>
              </span>
            </button>
            <button onClick={onOpenHospitals}>
              <Building2 size={18} />
              <span>
                <b>{L('Νοσοκομεία & Demo', 'Hospitals & Demo')}</b>
                <small>{L('Ενεργό, Demo, τύπος χρήσης', 'Active, Demo, plan')}</small>
              </span>
            </button>
          </div>
        </section>
      </div>

      <section className="owner-card">
        <header>
          <div>
            <span className="eyebrow">{L('ΠΕΛΑΤΕΣ', 'CUSTOMERS')}</span>
            <h2>{L('Νοσοκομεία', 'Hospitals')}</h2>
          </div>
          <span className="owner-count">{rows.length}</span>
        </header>
        <div className="owner-hospital-head">
          <span>{L('Νοσοκομείο', 'Hospital')}</span>
          <span>{L('Τύπος', 'Plan')}</span>
          <span>{L('Χρήστες', 'Users')}</span>
          <span>{L('Αιτήματα', 'Requests')}</span>
          <span></span>
        </div>
        <div className="owner-hospitals">
          {rows.length === 0 && (
            <p className="owner-empty">
              {L(
                'Δεν υπάρχουν νοσοκομεία ακόμα. Ξεκινήστε με «Νέο νοσοκομείο».',
                'No hospitals yet. Start with «New hospital».',
              )}
            </p>
          )}
          {rows.map(r => (
            <div key={r.org.id} className={`owner-hospital${r.org.active ? '' : ' inactive'}`}>
              <span className="owner-hospital-name">
                <b>{r.org.name}</b>
                <small>
                  {r.org.code}
                  {!r.org.active && ` · ${L('ανενεργό', 'inactive')}`}
                </small>
              </span>
              <span>
                {r.trial.plan !== 'TRIAL' ? (
                  <span className="plan-badge standard">{L('Κανονική χρήση', 'Standard use')}</span>
                ) : r.trial.ended ? (
                  <span className="plan-badge locked">{L('Κλειδωμένο', 'Locked')}</span>
                ) : (
                  <span className={`plan-badge trial${r.trial.warn ? ' warn' : ''}`}>
                    {L(`Δοκιμή · ${r.trial.daysLeft} ημ.`, `Trial · ${r.trial.daysLeft} d`)}
                  </span>
                )}
              </span>
              <span className="owner-num">
                <b>{r.active}</b>
                <small>/ {r.users}</small>
              </span>
              <span className={`owner-num${r.requests ? ' warn' : ''}`}>
                <b>{r.requests}</b>
              </span>
              <span className="owner-hospital-actions">
                {r.trial.plan === 'TRIAL' && (
                  <AppButton size="sm" onClick={() => onMakeStandard(r.org)}>
                    {L('Κανονική χρήση', 'Standard use')}
                  </AppButton>
                )}
                <button
                  className="owner-open"
                  onClick={() => onOpenUsers(r.org.id)}
                  aria-label={L(`Χρήστες ${r.org.name}`, `${r.org.name} users`)}
                  title={L('Χρήστες', 'Users')}
                >
                  <ChevronRight size={17} />
                </button>
              </span>
            </div>
          ))}
        </div>
        {locked.length + ending.length > 0 && (
          <p className="owner-footnote">
            <AlertTriangle size={14} />
            {L(
              'Μετά τη λήξη της δοκιμαστικής περιόδου το νοσοκομείο κλειδώνει για όλους εκτός από εσάς. Τα δεδομένα μένουν.',
              'After a trial ends the hospital locks for everyone but you. The data stays.',
            )}
          </p>
        )}
      </section>
    </div>
  );
}
