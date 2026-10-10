import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {
  CalendarPlus,
  CheckCircle2,
  Circle,
  FlaskConical,
  ListChecks,
  MessageSquareHeart,
  ShoppingBag,
  Star,
  X,
} from 'lucide-react';
import {useAppPreferences} from '../../core/AppPreferences';
import {guideProgress, guideSteps, visitStepsFor, type GuideStep} from '../../core/demoGuide';
import {screenTopic, tourFor, tourTopic, type Tour} from '../../core/demoTours';
import {demoDaysLeft} from '../../core/demoAccounts';
import {formatDate} from '../../core/displayDate';
import type {UserRole} from '../../store/types';
import {useEvaluationDemo} from '../../data/cloud/demoContext';
import {findDoneRecordSteps, loadGuideDone, markGuideSteps} from '../../data/cloud/demoGuide';
import {getRealIdentity} from '../../data/cloud/identity';
import {FINAL_TOPIC, stepTopic, suggestFinal} from '../../core/demoFeedback';
import {loadMyFeedback, rateModule, type DemoRequestKind, type FeedbackRow} from '../../data/cloud/demoFeedback';
import StarRating from '../demo/StarRating';
import DemoRequestDialog from '../demo/DemoRequestDialog';
import FinalEvaluationDialog from '../demo/FinalEvaluationDialog';
import StepRatingCard from '../demo/StepRatingCard';
import GuidedTour from '../demo/GuidedTour';
import DemoWelcome from '../demo/DemoWelcome';

const seenKey = (userId: string) => `surgitrack-demo-guide-seen-${userId}`;

/** At most one check of the person's records per this many milliseconds, however often the app saves. */
const CHECK_EVERY_MS = 5000;

/**
 * The bar of a prospect's evaluation Demo: days left, the first-steps guide (steps complete
 * themselves; "Show me" opens the screen with its Help), and "I want the application" / "Ask for
 * more time". As soon as a step is done a card asks how it was (1–5 stars, a comment); after the last
 * step it asks for the final evaluation. `savedAt` is when the app last saved to the server: the
 * steps done by a record are checked then, so the card appears right after the action.
 */
export default function DemoBar({
  role,
  onShowMe,
  savedAt,
}: {
  role: UserRole;
  onShowMe: (to: string) => void;
  savedAt?: number;
}) {
  const demo = useEvaluationDemo();
  const {lang} = useAppPreferences();
  const L = (el: string, en: string) => (lang === 'el' ? el : en);
  const {pathname} = useLocation();
  const navigate = useNavigate();
  const userId = getRealIdentity()?.id;
  const steps = useMemo(() => guideSteps(role), [role]);
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<Map<string, FeedbackRow>>(new Map());
  const [dialog, setDialog] = useState<'final' | DemoRequestKind | null>(null);
  // Steps done since the app opened, waiting for their rating card; then, maybe, the final one.
  const [toAsk, setToAsk] = useState<string[]>([]);
  const [askFinalNow, setAskFinalNow] = useState(false);
  // Steps found on opening the app were done earlier: only steps done from then on bring the card.
  const ready = useRef(false);
  const lastCheck = useRef(0);
  // The guided tour on the screen, the step whose tour just ended (its rating card), the welcome on
  // the first visit, and the person's own rating of the screen they are on.
  const [tour, setTour] = useState<{step: GuideStep; tour: Tour} | null>(null);
  const [toursDone, setToursDone] = useState<string[]>([]);
  const [welcome, setWelcome] = useState(false);
  const [rateScreen, setRateScreen] = useState<{topic: string; title: string} | null>(null);

  useEffect(() => {
    if (!demo || !userId) return;
    loadMyFeedback(demo.organizationId, userId)
      .then(setFeedback)
      .catch(() => undefined);
  }, [demo, userId]);
  const rate = (topic: string, rating: number, comment?: string) => {
    if (!demo || !userId) return;
    setFeedback(prev =>
      new Map(prev).set(topic, {
        topic,
        nps: null,
        answers: {},
        ...prev.get(topic),
        rating,
        comment: comment ?? prev.get(topic)?.comment ?? null,
      }),
    );
    void rateModule(demo.organizationId, userId, topic, rating, comment).catch(() => undefined);
  };

  const add = useCallback(
    async (keys: string[]) => {
      if (!demo || !userId || !keys.length) return;
      setDone(prev => {
        const fresh = keys.filter(k => !prev.has(k));
        const next = new Set([...prev, ...fresh]);
        if (ready.current && fresh.length) {
          setToAsk(queue => [...queue, ...fresh.filter(k => !queue.includes(k))]);
          if (steps.every(s => next.has(s.key))) setAskFinalNow(true);
        }
        return next;
      });
      await markGuideSteps(demo.organizationId, userId, keys).catch(() => undefined);
    },
    [demo, userId, steps],
  );

  // What is done already, and any record step the person has done since.
  const refresh = useCallback(async () => {
    if (!demo || !userId) return;
    try {
      const known = await loadGuideDone(demo.organizationId, userId);
      setDone(prev => new Set([...prev, ...known]));
      await add(await findDoneRecordSteps(demo.organizationId, userId, steps, known));
    } catch {
      // The guide is a help: without it the Demo still works.
    } finally {
      ready.current = true;
    }
  }, [demo, userId, steps, add]);

  // The app saved to the server: a record the person just made may complete a step.
  useEffect(() => {
    if (!demo || !userId || !savedAt || !ready.current) return;
    if (!steps.some(s => s.check.kind === 'record' && !done.has(s.key))) return;
    const wait = Math.max(0, lastCheck.current + CHECK_EVERY_MS - Date.now());
    const timer = window.setTimeout(() => {
      lastCheck.current = Date.now();
      findDoneRecordSteps(demo.organizationId, userId, steps, done)
        .then(add)
        .catch(() => undefined);
    }, wait);
    return () => window.clearTimeout(timer);
    // Only a new save starts a check; `done` is read as it is then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAt]);

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

  // The welcome shows by itself the first time, once per person and browser.
  useEffect(() => {
    if (!userId) return;
    try {
      if (!localStorage.getItem(seenKey(userId))) {
        localStorage.setItem(seenKey(userId), '1');
        setWelcome(true);
      }
    } catch {
      // Without storage it simply stays closed.
    }
  }, [userId]);

  if (!demo) return null;
  // "Show me": the tour on the real screen when the step has one, else the screen with its Help.
  const showMe = (step: GuideStep) => {
    const stepTour = tourFor(step.key);
    if (!stepTour) return onShowMe(step.to);
    navigate(stepTour.to);
    setTour({step, tour: stepTour});
  };
  const tourEnded = (step: GuideStep) => {
    setTour(null);
    setToursDone(list => (list.includes(step.key) ? list : [...list, step.key]));
    if (userId) void markGuideSteps(demo.organizationId, userId, [tourTopic(step.key)]).catch(() => undefined);
  };
  const progress = guideProgress(steps, done);
  const days = demoDaysLeft({endsAt: demo.endsAt});
  const ending = days <= 3;
  const finalDone = feedback.has(FINAL_TOPIC);
  const askFinal = !finalDone && suggestFinal(progress, days);
  // The card: the oldest step done and not rated yet; after the last step, the final evaluation.
  const asking = steps.find(s => s.key === toAsk.find(k => !feedback.get(stepTopic(k))?.rating));
  const cardFinal = !asking && askFinalNow && !finalDone;
  const later = (key?: string) => (key ? setToAsk(queue => queue.filter(k => k !== key)) : setAskFinalNow(false));
  // After a tour, how it was (once per tour and session), unless a step's own card is asking.
  const tourToRate = !asking && !cardFinal ? steps.find(s => toursDone.includes(s.key)) : undefined;
  const cardBusy = !!(asking || cardFinal || tourToRate || tour || welcome);
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
        {(askFinal || finalDone) && (
          <button
            type="button"
            className={`demo-bar-action${askFinal ? ' highlight' : ''}`}
            onClick={() => setDialog('final')}
          >
            <MessageSquareHeart size={15} />
            {finalDone ? L('Η αξιολόγησή σας', 'Your evaluation') : L('Αξιολόγηση', 'Evaluate')}
          </button>
        )}
        <button type="button" className="demo-bar-action" onClick={() => setDialog('EXTENSION')}>
          <CalendarPlus size={15} />
          {L('Ζητώ παράταση', 'More time')}
        </button>
        <button type="button" className="demo-bar-action primary" onClick={() => setDialog('PURCHASE')}>
          <ShoppingBag size={15} />
          {L('Θέλω την εφαρμογή', 'I want it')}
        </button>
      </div>
      {(asking || cardFinal) && !dialog && (
        <StepRatingCard
          key={asking?.key || 'final'}
          L={L}
          step={asking && {title: L(asking.title.el, asking.title.en)}}
          onRate={(rating, comment) => {
            if (!asking) return;
            rate(stepTopic(asking.key), rating, comment);
            later(asking.key);
          }}
          onLater={() => later(asking?.key)}
          onFinal={() => {
            later();
            setDialog('final');
          }}
        />
      )}
      {tourToRate && !dialog && (
        <StepRatingCard
          key={`tour-${tourToRate.key}`}
          L={L}
          heading={L(`Ξενάγηση: ${tourToRate.title.el}`, `Tour: ${tourToRate.title.en}`)}
          step={{title: L(tourToRate.title.el, tourToRate.title.en)}}
          onRate={(rating, comment) => {
            rate(tourTopic(tourToRate.key), rating, comment);
            setToursDone(list => list.filter(k => k !== tourToRate.key));
          }}
          onLater={() => setToursDone(list => list.filter(k => k !== tourToRate.key))}
          onFinal={() => undefined}
        />
      )}
      {rateScreen && !cardBusy && !dialog && (
        <StepRatingCard
          key={rateScreen.topic}
          L={L}
          heading={L(`Αξιολογήστε: ${rateScreen.title}`, `Rate: ${rateScreen.title}`)}
          step={{title: rateScreen.title}}
          onRate={(rating, comment) => {
            rate(rateScreen.topic, rating, comment);
            setRateScreen(null);
          }}
          onLater={() => setRateScreen(null)}
          onFinal={() => undefined}
        />
      )}
      {!rateScreen && !cardBusy && !dialog && (
        <button
          type="button"
          className="demo-rate-screen"
          onClick={() =>
            setRateScreen({
              topic: screenTopic(pathname),
              title: document.querySelector('.content h1')?.textContent?.trim() || 'SurgiTrack',
            })
          }
        >
          <Star size={15} />
          {L('Αξιολογήστε την οθόνη', 'Rate this screen')}
          {feedback.get(screenTopic(pathname))?.rating ? <b>{feedback.get(screenTopic(pathname))!.rating}★</b> : null}
        </button>
      )}
      {tour && (
        <GuidedTour
          key={tour.step.key}
          tour={tour.tour}
          L={L}
          onClose={() => setTour(null)}
          onDone={() => tourEnded(tour.step)}
        />
      )}
      {welcome && (
        <DemoWelcome
          L={L}
          hospitalName={demo.hospitalName}
          days={days}
          firstStep={progress.next && L(progress.next.title.el, progress.next.title.en)}
          onTour={() => {
            setWelcome(false);
            if (progress.next) showMe(progress.next);
            else setOpen(true);
          }}
          onSteps={() => {
            setWelcome(false);
            setOpen(true);
          }}
        />
      )}
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
                  {isDone ? (
                    <StarRating
                      label={L(step.title.el, step.title.en)}
                      value={feedback.get(stepTopic(step.key))?.rating}
                      onChange={rating => rate(stepTopic(step.key), rating)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        showMe(step);
                      }}
                    >
                      {L('Δείξε μου', 'Show me')}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
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
