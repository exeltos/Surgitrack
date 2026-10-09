import {useState} from 'react';
import {BadgeCheck, Check, Copy, LogIn, Mail, Plus, RotateCcw, Send} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {useConfirm} from '../../../components/ui/useConfirm';
import {tr} from '../../../i18n';
import {formatDate} from '../../../core/displayDate';
import {
  DEMO_DELETE_AFTER_DAYS,
  DEMO_EXTENSION_DAYS,
  demoDaysLeft,
  demoDeleteOn,
  demoFunnel,
  demoStage,
  type DemoAccount,
  type DemoStage,
} from '../../../core/demoAccounts';
import {trialEndDate, trialEndOn} from '../../../core/trial';
import {MODULES, npsGroup} from '../../../core/demoFeedback';
import NewDemoDialog from './NewDemoDialog';
import ConvertDemoDialog from './ConvertDemoDialog';
import {useDemoAccounts} from './useDemoAccounts';

const STAGE_LABEL: Record<DemoStage, string> = {
  PREPARING: 'Σε προετοιμασία',
  INVITED: 'Στάλθηκε',
  ACTIVE: 'Σε αξιολόγηση',
  ENDED: 'Έληξε',
  CONVERTED: 'Έγινε πελάτης',
};

const FUNNEL_LABEL: Record<ReturnType<typeof demoFunnel>['steps'][number]['key'], string> = {
  opened: 'Demo',
  sent: 'Email',
  signedIn: 'Σύνδεση',
  tried: 'Δοκιμή',
  evaluated: 'Αξιολόγηση',
  wanted: 'Θέλουν την εφαρμογή',
  converted: 'Πελάτες',
};

/** Studio → Platform: the prospects' evaluation Demos, each with its own hospital and sample data. */
export default function DemoAccountsPanel({
  creating: creatingProp,
  onCreatingChange,
}: {
  /** Whether the new-Demo form is open, when the page opens it from its own button. */
  creating?: boolean;
  onCreatingChange?: (open: boolean) => void;
} = {}) {
  const d = useDemoAccounts();
  const [creatingOwn, setCreatingOwn] = useState(false);
  const creating = creatingProp ?? creatingOwn;
  const setCreating = (open: boolean) => (onCreatingChange ? onCreatingChange(open) : setCreatingOwn(open));
  const [confirmNode, ask] = useConfirm();
  const [converting, setConverting] = useState<DemoAccount | null>(null);
  const counts = d.demos.reduce(
    (acc, demo) => ({...acc, [demoStage(demo)]: (acc[demoStage(demo)] || 0) + 1}),
    {} as Partial<Record<DemoStage, number>>,
  );
  return (
    <section
      className={`platform-evaluation-demos ${onCreatingChange ? 'embedded' : ''}`}
      aria-label={tr('Demo αξιολόγησης')}
    >
      <header>
        <small>
          {tr(
            'Κάθε Demo είναι ξεχωριστό νοσοκομείο με δοκιμαστικά δεδομένα. Ο υπεύθυνος λαμβάνει email με τον λογαριασμό του και το Demo κλειδώνει στη λήξη του.',
          )}
        </small>
        {!onCreatingChange && (
          <AppButton variant="primary" onClick={() => setCreating(true)} disabled={!!d.busy}>
            <Plus size={16} />
            {tr('Νέο Demo')}
          </AppButton>
        )}
      </header>
      {!!d.demos.length && (
        <div className="evaluation-demo-counts">
          {(Object.keys(STAGE_LABEL) as DemoStage[]).map(stage => (
            <span key={stage} className={`evaluation-demo-stage ${stage.toLowerCase()}`}>
              {tr(STAGE_LABEL[stage])}: <b>{counts[stage] || 0}</b>
            </span>
          ))}
        </div>
      )}
      {d.demos.length > 1 && <DemoFunnel demos={d.demos} />}
      {d.busy?.id === 'new' && <p className="evaluation-demo-busy">{d.busy.label}</p>}
      {d.notice && (
        <div
          className={`evaluation-demo-notice ${d.notice.kind}`}
          role={d.notice.kind === 'error' ? 'alert' : 'status'}
        >
          <span>{d.notice.text}</span>
          {d.notice.url && (
            <button onClick={() => void navigator.clipboard?.writeText(d.notice!.url!)}>
              <Copy size={14} />
              {tr('Αντιγραφή συνδέσμου')}
            </button>
          )}
          <button
            className="evaluation-demo-notice-close"
            onClick={() => d.setNotice(null)}
            aria-label={tr('Κλείσιμο')}
          >
            ×
          </button>
        </div>
      )}
      {d.loading ? (
        <p className="evaluation-demo-empty">{tr('Φόρτωση…')}</p>
      ) : !d.demos.length ? (
        <p className="evaluation-demo-empty">{tr('Δεν έχει ανοίξει κανένα Demo αξιολόγησης.')}</p>
      ) : (
        <div className="evaluation-demo-list">
          {d.demos.map(demo => (
            <DemoCard
              key={demo.id}
              demo={demo}
              busy={d.busy?.id === demo.id ? d.busy.label : d.busy ? 'other' : null}
              onContinue={() => void d.continuePreparing(demo)}
              onResend={() => void d.resend(demo)}
              onExtend={() => void d.extend(demo)}
              onChangeEnd={date => void d.changeEnd(demo, trialEndOn(date))}
              onChangeLimit={limit => void d.changeLimit(demo, limit)}
              onHandled={requestId => void d.handleRequest(demo, requestId)}
              onAutoDelete={autoDelete => void d.changeAutoDelete(demo, autoDelete)}
              onConvert={() => setConverting(demo)}
              onEnter={() => d.enter(demo)}
              onReset={() =>
                ask({
                  title: tr('Επαναφορά δεδομένων'),
                  message: tr(
                    'Θα διαγραφούν όλα τα δεδομένα του «{0}» και θα φορτωθούν ξανά τα αρχικά δοκιμαστικά. Οι χρήστες και τα τμήματα μένουν.',
                    demo.organizationName,
                  ),
                  confirmLabel: tr('Επαναφορά'),
                  danger: true,
                  onConfirm: () => void d.reset(demo),
                })
              }
            />
          ))}
        </div>
      )}
      {creating && (
        <NewDemoDialog
          onClose={() => setCreating(false)}
          onCreate={demo => {
            setCreating(false);
            void d.create(demo);
          }}
        />
      )}
      {converting && (
        <ConvertDemoDialog
          demo={converting}
          onClose={() => setConverting(null)}
          onConvert={conversion => {
            const demo = converting;
            setConverting(null);
            ask({
              title: tr('Μετατροπή σε πελάτη'),
              message: conversion.keepData
                ? tr('Το «{0}» γίνεται κανονικό νοσοκομείο με τα δεδομένα του Demo.', conversion.name)
                : tr(
                    'Το «{0}» γίνεται κανονικό νοσοκομείο και τα δοκιμαστικά δεδομένα διαγράφονται. Οι χρήστες και τα τμήματα μένουν.',
                    conversion.name,
                  ),
              confirmLabel: tr('Μετατροπή'),
              danger: !conversion.keepData,
              onConfirm: () => void d.convert(demo, conversion),
            });
          }}
        />
      )}
      {confirmNode}
    </section>
  );
}

function DemoCard({
  demo,
  busy,
  onContinue,
  onResend,
  onExtend,
  onChangeEnd,
  onChangeLimit,
  onHandled,
  onAutoDelete,
  onConvert,
  onEnter,
  onReset,
}: {
  demo: DemoAccount;
  /** This Demo's running action, or 'other' while another one runs. */
  busy: string | null;
  onContinue: () => void;
  onResend: () => void;
  onExtend: () => void;
  onChangeEnd: (date: string) => void;
  onChangeLimit: (limit: number) => void;
  onHandled: (requestId: string) => void;
  onAutoDelete: (autoDelete: boolean) => void;
  onConvert: () => void;
  onEnter: () => void;
  onReset: () => void;
}) {
  const stage = demoStage(demo);
  const days = demoDaysLeft(demo);
  const disabled = !!busy;
  const [showColleagues, setShowColleagues] = useState(false);
  const newRequests = demo.requests.filter(r => r.status === 'NEW').length;
  const converted = stage === 'CONVERTED';
  const deleteOn = demoDeleteOn(demo);
  return (
    <article className={`evaluation-demo-card ${stage.toLowerCase()}`}>
      <div className="evaluation-demo-main">
        <div>
          <strong>{demo.hospitalName}</strong>
          <small>
            {demo.code} · {demo.contactName} · <a href={`mailto:${demo.contactEmail}`}>{demo.contactEmail}</a>
            {demo.contactPhone ? ` · ${demo.contactPhone}` : ''}
          </small>
          {demo.notes && <small className="evaluation-demo-notes">{demo.notes}</small>}
        </div>
        <span className="evaluation-demo-badges">
          {newRequests > 0 && (
            <span className="evaluation-demo-stage request">{tr('Νέα αιτήματα: {0}', newRequests)}</span>
          )}
          <span className={`evaluation-demo-stage ${stage.toLowerCase()}`}>{tr(STAGE_LABEL[stage])}</span>
        </span>
      </div>
      <dl className="evaluation-demo-facts">
        <div>
          <dt>{tr('Λήξη')}</dt>
          <dd>
            {demo.endsAt ? formatDate(demo.endsAt) : '—'}
            {stage !== 'ENDED' && demo.endsAt && <em>{tr(' · {0} ημέρες ακόμη', days)}</em>}
          </dd>
        </div>
        <div>
          <dt>{tr('Όνομα χρήστη')}</dt>
          <dd>{demo.evaluatorCode || '—'}</dd>
        </div>
        <div>
          <dt>{tr('Πρώτα βήματα')}</dt>
          <dd>{demo.evaluatorGuide ? `${demo.evaluatorGuide.done} / ${demo.evaluatorGuide.total}` : '—'}</dd>
        </div>
        <div>
          <dt>{tr('Συνάδελφοι')}</dt>
          <dd>
            {demo.colleagues.length ? (
              <button
                type="button"
                className="evaluation-demo-link"
                aria-expanded={showColleagues}
                onClick={() => setShowColleagues(v => !v)}
              >
                {demo.extraUsers} / {demo.maxExtraUsers}
              </button>
            ) : (
              `${demo.extraUsers} / ${demo.maxExtraUsers}`
            )}
          </dd>
        </div>
        <div>
          <dt>{tr('Email')}</dt>
          <dd>{demo.invitedAt ? formatDate(demo.invitedAt) : '—'}</dd>
        </div>
        <div>
          <dt>{converted ? tr('Πελάτης από') : tr('Διαγραφή')}</dt>
          <dd>
            {converted ? (
              demo.convertedAt ? (
                formatDate(demo.convertedAt)
              ) : (
                '—'
              )
            ) : (
              <label className="evaluation-demo-keep">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={demo.autoDelete}
                  onChange={e => onAutoDelete(e.target.checked)}
                  aria-label={tr('Αυτόματη διαγραφή {0} ημέρες μετά τη λήξη', DEMO_DELETE_AFTER_DAYS)}
                />
                {deleteOn ? formatDate(deleteOn) : tr('Διατηρείται')}
              </label>
            )}
          </dd>
        </div>
        <div>
          <dt>{tr('Δεδομένα')}</dt>
          <dd>
            {demo.lastLoad ? (
              <>
                {formatDate(demo.lastLoad.at)}
                <em>
                  {demo.lastLoad.kind === 'RESET'
                    ? tr(' · επαναφορά, {0} εγγραφές', demo.lastLoad.records)
                    : tr(' · {0} εγγραφές', demo.lastLoad.records)}
                </em>
              </>
            ) : demo.seededAt ? (
              formatDate(demo.seededAt)
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>
      {showColleagues && demo.colleagues.length > 0 && (
        <ul className="evaluation-demo-colleagues">
          {demo.colleagues.map(c => (
            <li key={c.id}>
              <b>{c.name}</b>
              <span>{c.email}</span>
              <span>{c.userCode || '—'}</span>
              <span>{tr('Βήματα {0}/{1}', c.guide.done, c.guide.total)}</span>
              <span>{c.active ? tr('Ενεργός') : tr('Περιμένει έγκριση ή ανενεργός')}</span>
            </li>
          ))}
        </ul>
      )}
      <DemoFeedback demo={demo} disabled={disabled} onHandled={onHandled} />
      {busy && busy !== 'other' ? (
        <p className="evaluation-demo-busy">{busy}</p>
      ) : converted ? (
        <div className="evaluation-demo-actions">
          <button disabled={disabled} onClick={onEnter}>
            <LogIn size={14} />
            {tr('Είσοδος')}
          </button>
        </div>
      ) : (
        <div className="evaluation-demo-actions">
          {stage === 'PREPARING' && (
            <button className="primary" disabled={disabled} onClick={onContinue}>
              <Send size={14} />
              {demo.seededAt ? tr('Αποστολή email') : tr('Συνέχεια προετοιμασίας')}
            </button>
          )}
          {stage === 'INVITED' && (
            <button disabled={disabled} onClick={onResend}>
              <Mail size={14} />
              {tr('Νέα αποστολή email')}
            </button>
          )}
          <button disabled={disabled} onClick={onExtend}>
            {tr('+{0} ημέρες', DEMO_EXTENSION_DAYS)}
          </button>
          <label className="evaluation-demo-end">
            {tr('Λήξη')}
            <input
              type="date"
              disabled={disabled}
              value={trialEndDate(demo.endsAt)}
              onChange={e => e.target.value && onChangeEnd(e.target.value)}
            />
          </label>
          <label className="evaluation-demo-end">
            {tr('Όριο συναδέλφων')}
            <select
              disabled={disabled}
              value={demo.maxExtraUsers}
              onChange={e => onChangeLimit(Number(e.target.value))}
            >
              {[0, 1, 2, 3, 4, 5, 8, 10, 15, 20].map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button disabled={disabled || !demo.seededAt} onClick={onEnter}>
            <LogIn size={14} />
            {tr('Είσοδος')}
          </button>
          {demo.status === 'SENT' && (
            <button className="primary" disabled={disabled} onClick={onConvert}>
              <BadgeCheck size={14} />
              {tr('Μετατροπή σε πελάτη')}
            </button>
          )}
          <button className="danger" disabled={disabled} onClick={onReset}>
            <RotateCcw size={14} />
            {tr('Επαναφορά δεδομένων')}
          </button>
        </div>
      )}
    </article>
  );
}

const moduleTitle = (key: string) => {
  const m = MODULES.find(x => x.key === key);
  return m ? tr(m.title.el) : key;
};
const stars = (n: number) => `${n.toFixed(1).replace('.', ',')} ★`;

/** What the people of the Demo think of it, and what they asked for. */
function DemoFeedback({
  demo,
  disabled,
  onHandled,
}: {
  demo: DemoAccount;
  disabled: boolean;
  onHandled: (requestId: string) => void;
}) {
  if (!demo.ratings.length && !demo.evaluations.length && !demo.requests.length) return null;
  return (
    <div className="evaluation-demo-feedback">
      {demo.requests.length > 0 && (
        <section aria-label={tr('Αιτήματα')}>
          <h4>{tr('Αιτήματα')}</h4>
          <ul>
            {demo.requests.map(r => (
              <li key={r.id} className={r.status === 'NEW' ? 'new' : 'handled'}>
                <b>{r.kind === 'PURCHASE' ? tr('Θέλει την εφαρμογή') : tr('Ζητά παράταση')}</b>
                <span>
                  {r.name || '—'}
                  {r.phone ? ` · ${r.phone}` : ''} · {formatDate(r.createdAt)}
                </span>
                {r.message && <q>{r.message}</q>}
                {r.status === 'NEW' ? (
                  <button disabled={disabled} onClick={() => onHandled(r.id)}>
                    <Check size={14} />
                    {tr('Διεκπεραιώθηκε')}
                  </button>
                ) : (
                  <em>{tr('Διεκπεραιώθηκε')}</em>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {demo.ratings.length > 0 && (
        <section aria-label={tr('Βαθμολογίες')}>
          <h4>{tr('Βαθμολογίες')}</h4>
          <ul className="evaluation-demo-ratings">
            {demo.ratings.map(r => (
              <li key={r.topic}>
                <span>{moduleTitle(r.topic)}</span>
                <b>{stars(r.average)}</b>
                <small>({r.count})</small>
              </li>
            ))}
          </ul>
        </section>
      )}
      {demo.evaluations.length > 0 && (
        <section aria-label={tr('Τελική αξιολόγηση')}>
          <h4>{tr('Τελική αξιολόγηση')}</h4>
          <ul>
            {demo.evaluations.map((e, i) => (
              <li key={i}>
                <b>{e.name || '—'}</b>
                {e.nps !== null && (
                  <span className={`evaluation-demo-nps ${npsGroup(e.nps).toLowerCase()}`}>
                    {tr('Σύσταση {0}/10', e.nps)}
                  </span>
                )}
                {e.ease !== undefined && <span>{tr('Ευκολία {0}/5', e.ease)}</span>}
                {e.fit !== undefined && <span>{tr('Ταιριάζει {0}/5', e.fit)}</span>}
                {(e.sets !== undefined || e.theatres !== undefined) && (
                  <span>{tr('Σετ {0} · Αίθουσες {1}', e.sets ?? '—', e.theatres ?? '—')}</span>
                )}
                {e.missing && <q>{tr('Λείπει: {0}', e.missing)}</q>}
                {e.comment && <q>{e.comment}</q>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** How far the Demos went: each step with how many Demos reached it, and the average NPS. */
function DemoFunnel({demos}: {demos: DemoAccount[]}) {
  const funnel = demoFunnel(demos);
  const total = Math.max(1, funnel.steps[0].count);
  return (
    <div className="evaluation-demo-funnel" aria-label={tr('Πορεία των Demo')}>
      <ol>
        {funnel.steps.map(step => (
          <li key={step.key}>
            <span>{tr(FUNNEL_LABEL[step.key])}</span>
            <b>{step.count}</b>
            <small>{Math.round((step.count / total) * 100)}%</small>
            <i aria-hidden="true" style={{width: `${(step.count / total) * 100}%`}} />
          </li>
        ))}
      </ol>
      {funnel.averageNps !== undefined && (
        <p>
          {tr('Μέση σύσταση')}: <b>{funnel.averageNps.toFixed(1).replace('.', ',')}/10</b>
        </p>
      )}
    </div>
  );
}
