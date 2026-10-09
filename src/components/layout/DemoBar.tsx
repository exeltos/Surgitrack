import {useCallback, useEffect, useMemo, useState} from 'react';
import {useLocation} from 'react-router-dom';
import {
  CalendarPlus,
  CheckCircle2,
  Circle,
  FlaskConical,
  ListChecks,
  MessageSquareHeart,
  ShoppingBag,
  X,
} from 'lucide-react';
import {useAppPreferences} from '../../core/AppPreferences';
import {guideProgress, guideSteps, visitStepsFor} from '../../core/demoGuide';
import {demoDaysLeft} from '../../core/demoAccounts';
import {formatDate} from '../../core/displayDate';
import type {UserRole} from '../../store/types';
import {useEvaluationDemo} from '../../data/cloud/demoContext';
import {findDoneRecordSteps, loadGuideDone, markGuideSteps} from '../../data/cloud/demoGuide';
import {getRealIdentity} from '../../data/cloud/identity';
import {FINAL_TOPIC, modulesToRate, suggestFinal} from '../../core/demoFeedback';
import {loadMyFeedback, rateModule, type DemoRequestKind, type FeedbackRow} from '../../data/cloud/demoFeedback';
import StarRating from '../demo/StarRating';
import DemoRequestDialog from '../demo/DemoRequestDialog';
import FinalEvaluationDialog from '../demo/FinalEvaluationDialog';

const seenKey = (userId: string) => `surgitrack-demo-guide-seen-${userId}`;

/**
 * The bar of a prospect's evaluation Demo: days left, the first-steps guide (steps complete
 * themselves; "Show me" opens the screen with its Help), a 1–5 rating of each part tried, the
 * final evaluation, and "I want the application" / "Ask for more time".
 */
export default function DemoBar({role, onShowMe}: {role: UserRole; onShowMe: (to: string) => void}) {
  const demo = useEvaluationDemo();
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const {pathname} = useLocation();
  const userId = getRealIdentity()?.id;
  const steps = useMemo(() => guideSteps(role), [role]);
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<Map<string, FeedbackRow>>(new Map());
  const [dialog, setDialog] = useState<'final' | DemoRequestKind | null>(null);

  useEffect(() => {
    if (!demo || !userId) return;
    loadMyFeedback(demo.organizationId, userId)
      .then(setFeedback)
      .catch(() => undefined);
  }, [demo, userId]);
  const rate = (topic: string, rating: number) => {
    if (!demo || !userId) return;
    setFeedback(prev =>
      new Map(prev).set(topic, {topic, nps: null, answers: {}, comment: null, ...prev.get(topic), rating}),
    );
    void rateModule(demo.organizationId, userId, topic, rating).catch(() => undefined);
  };

  const add = useCallback(
    async (keys: string[]) => {
      if (!demo || !userId || !keys.length) return;
      setDone(prev => new Set([...prev, ...keys]));
      await markGuideSteps(demo.organizationId, userId, keys).catch(() => undefined);
    },
    [demo, userId],
  );

  // What is done already, and any record step the person has done since.
  const refresh = useCallback(async () => {
    if (!demo || !userId) return;
    try {
      const known = await loadGuideDone(demo.organizationId, userId);
      setDone(known);
      await add(await findDoneRecordSteps(demo.organizationId, userId, steps, known));
    } catch {
      // The guide is a help: without it the Demo still works.
    }
  }, [demo, userId, steps, add]);

  // On opening the app, and each time the guide opens (records made since then show as done).
  useEffect(() => {
    if (open || !done.size) void refresh();
    // Only these moments; `done` changing must not reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, open]);

  // Opening a screen completes its visit steps.
  useEffect(() => {
    const keys = visitStepsFor(steps, pathname)
      .map(s => s.key)
      .filter(k => !done.has(k));
    if (keys.length) void add(keys);
  }, [pathname, steps, done, add]);

  // The guide opens by itself the first time, once per person and browser.
  useEffect(() => {
    if (!userId) return;
    try {
      if (!localStorage.getItem(seenKey(userId))) {
        localStorage.setItem(seenKey(userId), '1');
        setOpen(true);
      }
    } catch {
      // Without storage it simply stays closed.
    }
  }, [userId]);

  if (!demo) return null;
  const progress = guideProgress(steps, done);
  const days = demoDaysLeft({endsAt: demo.endsAt});
  const ending = days <= 3;
  const toRate = modulesToRate(steps, done);
  const finalDone = feedback.has(FINAL_TOPIC);
  const askFinal = !finalDone && suggestFinal(progress, days);
  return (
    <>
      <div className={`demo-bar${ending ? ' ending' : ''}`} role="status">
        <span className="demo-bar-chip">
          <FlaskConical size={14} /> DEMO
        </span>
        <span className="demo-bar-text">
          {demo.endsAt
            ? L(
                `${days === 1 ? 'Απομένει 1 ημέρα' : `Απομένουν ${days} ημέρες`} (έως ${formatDate(demo.endsAt)}) · δοκιμαστικά δεδομένα`,
                `${days === 1 ? '1 day left' : `${days} days left`} (until ${formatDate(demo.endsAt)}) · sample data`,
              )
            : L('Δοκιμαστικά δεδομένα', 'Sample data')}
        </span>
        <button type="button" className="demo-bar-guide" onClick={() => setOpen(v => !v)} aria-expanded={open}>
          <ListChecks size={15} />
          {L('Πρώτα βήματα', 'First steps')}
          <b>
            {progress.done}/{progress.total}
          </b>
        </button>
        <button
          type="button"
          className={`demo-bar-action${askFinal ? ' highlight' : ''}`}
          onClick={() => setDialog('final')}
        >
          <MessageSquareHeart size={15} />
          {finalDone ? L('Η αξιολόγησή σας', 'Your evaluation') : L('Αξιολόγηση', 'Evaluate')}
        </button>
        <button type="button" className="demo-bar-action" onClick={() => setDialog('EXTENSION')}>
          <CalendarPlus size={15} />
          {L('Ζητώ παράταση', 'More time')}
        </button>
        <button type="button" className="demo-bar-action primary" onClick={() => setDialog('PURCHASE')}>
          <ShoppingBag size={15} />
          {L('Θέλω την εφαρμογή', 'I want it')}
        </button>
      </div>
      {dialog === 'final' && userId && (
        <FinalEvaluationDialog
          organizationId={demo.organizationId}
          userId={userId}
          current={feedback.get(FINAL_TOPIC)}
          L={L}
          onClose={() => setDialog(null)}
          onSaved={row => setFeedback(prev => new Map(prev).set(FINAL_TOPIC, row))}
        />
      )}
      {(dialog === 'PURCHASE' || dialog === 'EXTENSION') && userId && (
        <DemoRequestDialog
          kind={dialog}
          organizationId={demo.organizationId}
          userId={userId}
          L={L}
          onClose={() => setDialog(null)}
        />
      )}
      {open && (
        <aside className="demo-guide" aria-label={L('Πρώτα βήματα', 'First steps')}>
          <header>
            <div>
              <strong>{L('Πρώτα βήματα', 'First steps')}</strong>
              <small>
                {progress.done === progress.total
                  ? L('Ολοκληρώσατε όλα τα βήματα. Μπράβο!', 'You have done every step. Well done!')
                  : L(
                      'Κάθε βήμα ολοκληρώνεται μόλις το κάνετε στην εφαρμογή.',
                      'Each step completes itself once you do it in the app.',
                    )}
              </small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={L('Κλείσιμο', 'Close')}>
              <X size={16} />
            </button>
          </header>
          <div className="demo-guide-meter" aria-hidden="true">
            <span style={{width: `${(progress.done / Math.max(1, progress.total)) * 100}%`}} />
          </div>
          <ol>
            {steps.map(step => {
              const isDone = done.has(step.key);
              const isNext = progress.next?.key === step.key;
              return (
                <li key={step.key} className={`${isDone ? 'done' : ''}${isNext ? ' next' : ''}`}>
                  {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  <div>
                    <b>{L(step.title.el, step.title.en)}</b>
                    <small>{L(step.text.el, step.text.en)}</small>
                  </div>
                  {!isDone && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onShowMe(step.to);
                      }}
                    >
                      {L('Δείξε μου', 'Show me')}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          {toRate.length > 0 && (
            <section className="demo-guide-rate">
              <strong>{L('Πώς σας φάνηκαν;', 'How did you find them?')}</strong>
              {toRate.map(m => (
                <div key={m.key}>
                  <span>{L(m.title.el, m.title.en)}</span>
                  <StarRating
                    label={L(m.title.el, m.title.en)}
                    value={feedback.get(m.key)?.rating}
                    onChange={rating => rate(m.key, rating)}
                  />
                </div>
              ))}
            </section>
          )}
          {askFinal && (
            <button type="button" className="demo-guide-final" onClick={() => setDialog('final')}>
              <MessageSquareHeart size={16} />
              {L('Πείτε μας τη γνώμη σας για το SurgiTrack', 'Tell us what you think of SurgiTrack')}
            </button>
          )}
        </aside>
      )}
    </>
  );
}
