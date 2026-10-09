import {useState} from 'react';
import {Copy, LogIn, Mail, Plus, RotateCcw, Send} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {useConfirm} from '../../../components/ui/useConfirm';
import {tr} from '../../../i18n';
import {formatDate} from '../../../core/displayDate';
import {
  DEMO_EXTENSION_DAYS,
  demoDaysLeft,
  demoStage,
  type DemoAccount,
  type DemoStage,
} from '../../../core/demoAccounts';
import {trialEndDate, trialEndOn} from '../../../core/trial';
import NewDemoDialog from './NewDemoDialog';
import {useDemoAccounts} from './useDemoAccounts';

const STAGE_LABEL: Record<DemoStage, string> = {
  PREPARING: 'Σε προετοιμασία',
  INVITED: 'Στάλθηκε',
  ACTIVE: 'Σε αξιολόγηση',
  ENDED: 'Έληξε',
};

/** Studio → Platform: the prospects' evaluation Demos, each with its own hospital and sample data. */
export default function DemoAccountsPanel() {
  const d = useDemoAccounts();
  const [creating, setCreating] = useState(false);
  const [confirmNode, ask] = useConfirm();
  const counts = d.demos.reduce(
    (acc, demo) => ({...acc, [demoStage(demo)]: (acc[demoStage(demo)] || 0) + 1}),
    {} as Partial<Record<DemoStage, number>>,
  );
  return (
    <section className="platform-evaluation-demos" aria-label={tr('Demo αξιολόγησης')}>
      <header>
        <div>
          <span className="eyebrow">{tr('DEMO ΑΞΙΟΛΟΓΗΣΗΣ')}</span>
          <strong>{tr('Demo για υποψήφιους πελάτες')}</strong>
          <small>
            {tr(
              'Κάθε Demo είναι ξεχωριστό νοσοκομείο με δοκιμαστικά δεδομένα. Ο υπεύθυνος λαμβάνει email με τον λογαριασμό του και το Demo κλειδώνει στη λήξη του.',
            )}
          </small>
        </div>
        <AppButton variant="primary" onClick={() => setCreating(true)} disabled={!!d.busy}>
          <Plus size={16} />
          {tr('Νέο Demo')}
        </AppButton>
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
  onEnter: () => void;
  onReset: () => void;
}) {
  const stage = demoStage(demo);
  const days = demoDaysLeft(demo);
  const disabled = !!busy;
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
        <span className={`evaluation-demo-stage ${stage.toLowerCase()}`}>{tr(STAGE_LABEL[stage])}</span>
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
          <dt>{tr('Συνάδελφοι')}</dt>
          <dd>
            {demo.extraUsers} / {demo.maxExtraUsers}
          </dd>
        </div>
        <div>
          <dt>{tr('Email')}</dt>
          <dd>{demo.invitedAt ? formatDate(demo.invitedAt) : '—'}</dd>
        </div>
      </dl>
      {busy && busy !== 'other' ? (
        <p className="evaluation-demo-busy">{busy}</p>
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
          <button disabled={disabled || !demo.seededAt} onClick={onEnter}>
            <LogIn size={14} />
            {tr('Είσοδος')}
          </button>
          <button className="danger" disabled={disabled} onClick={onReset}>
            <RotateCcw size={14} />
            {tr('Επαναφορά δεδομένων')}
          </button>
        </div>
      )}
    </article>
  );
}
