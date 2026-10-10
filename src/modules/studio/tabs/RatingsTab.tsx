import {useCallback, useEffect, useMemo, useState} from 'react';
import {MessageSquareHeart, RefreshCw, Star} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import Spinner from '../../../components/ui/Spinner';
import type {DemoAccount} from '../../../core/demoAccounts';
import {npsGroup} from '../../../core/demoFeedback';
import {summarizeRatings, type RatingKind} from '../../../core/demoRatings';
import {loadDemoAccounts} from '../../../data/cloud/demoAccounts';
import {moduleTitle, stars} from '../demo/ratingTitles';
import type {StudioPageState} from '../useStudioPage';

const KINDS: Array<{kind: RatingKind; el: string; en: string}> = [
  {kind: 'TOUR', el: 'Ξεναγήσεις', en: 'Guided tours'},
  {kind: 'STEP', el: 'Πρώτα βήματα', en: 'First steps'},
  {kind: 'SCREEN', el: 'Οθόνες', en: 'Screens'},
  {kind: 'MODULE', el: 'Ενότητες', en: 'Parts of the app'},
];

/**
 * The platform owner's view of what the evaluation Demos think: every rating together (tours, first steps,
 * screens), with the comments and the hospital they came from, and the final evaluations with the NPS.
 * One Demo or all of them.
 */
export default function RatingsTab({s}: {s: StudioPageState}) {
  const {L, platformAdmin, selectTab, tab} = s;
  const [demos, setDemos] = useState<DemoAccount[] | null>(null);
  const [failed, setFailed] = useState('');
  const [demoId, setDemoId] = useState('');
  const active = tab === 'RATINGS' && platformAdmin;
  const load = useCallback(async () => {
    setFailed('');
    try {
      setDemos(await loadDemoAccounts());
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String((e as {message?: string})?.message || e));
      setDemos([]);
    }
  }, []);
  useEffect(() => {
    if (active) void load();
  }, [active, load]);
  const shown = useMemo(() => (demos || []).filter(d => !demoId || d.id === demoId), [demos, demoId]);
  const summary = useMemo(() => summarizeRatings(shown), [shown]);
  if (!active) return null;

  const npsLabel = (nps: number) => `${nps > 0 ? '+' : ''}${nps}`;
  return (
    <section className="studio-errors studio-ratings">
      <header className="studio-errors-head">
        <div>
          <h2>{L('Αξιολογήσεις από τα Demo', 'Ratings from the Demos')}</h2>
          <p>
            {L(
              'Ό,τι βαθμολόγησαν οι υποψήφιοι πελάτες: τις ξεναγήσεις, τα πρώτα βήματα και κάθε οθόνη, με τα σχόλιά τους, και την τελική τους αξιολόγηση.',
              'What prospects rated: the guided tours, the first steps and each screen, with their comments, and their final evaluation.',
            )}
          </p>
        </div>
        <div className="studio-errors-actions">
          <select value={demoId} onChange={e => setDemoId(e.target.value)} aria-label={L('Demo', 'Demo')}>
            <option value="">{L('Όλα τα Demo', 'Every Demo')}</option>
            {(demos || []).map(d => (
              <option key={d.id} value={d.id}>
                {d.hospitalName}
              </option>
            ))}
          </select>
          <AppButton icon={<RefreshCw size={16} />} onClick={() => void load()}>
            {L('Ανανέωση', 'Refresh')}
          </AppButton>
        </div>
      </header>
      {failed && <p className="studio-errors-failed">{failed}</p>}
      {demos === null ? (
        <Spinner />
      ) : (
        <>
          <div className="studio-ratings-kpis">
            <div>
              <span>{L('Μέση βαθμολογία', 'Average rating')}</span>
              <strong>{summary.average !== undefined ? stars(summary.average) : '—'}</strong>
              <small>{L(`${summary.rated} βαθμολογίες`, `${summary.rated} ratings`)}</small>
            </div>
            <div>
              <span>NPS</span>
              <strong className={summary.nps !== undefined && summary.nps < 0 ? 'negative' : ''}>
                {summary.nps !== undefined ? npsLabel(summary.nps) : '—'}
              </strong>
              <small>
                {L(
                  `${summary.evaluations.length} τελικές αξιολογήσεις`,
                  `${summary.evaluations.length} final evaluations`,
                )}
              </small>
            </div>
            <div>
              <span>Demo</span>
              <strong>{shown.length}</strong>
              <small>{L('σε αξιολόγηση', 'being evaluated')}</small>
            </div>
            <button
              type="button"
              className={summary.newRequests ? 'attention' : ''}
              onClick={() => selectTab('PLATFORM')}
            >
              <span>{L('Νέα αιτήματα', 'New requests')}</span>
              <strong>{summary.newRequests}</strong>
              <small>{L('Αγορά ή παράταση · Νοσοκομεία & Demo', 'Purchase or more time · Hospitals & Demo')}</small>
            </button>
          </div>

          {!summary.ratings.length && !summary.evaluations.length ? (
            <div className="studio-errors-empty">
              <MessageSquareHeart size={22} />
              <strong>{L('Καμία αξιολόγηση ακόμη', 'No ratings yet')}</strong>
              <span>
                {L(
                  'Εμφανίζονται εδώ μόλις οι χρήστες ενός Demo βαθμολογήσουν μια ξενάγηση, ένα βήμα ή μια οθόνη.',
                  'They show here as soon as a Demo’s users rate a tour, a step or a screen.',
                )}
              </span>
            </div>
          ) : (
            <div className="studio-ratings-body">
              {KINDS.map(({kind, el, en}) => {
                const rows = summary.ratings
                  .filter(r => r.kind === kind)
                  .sort(
                    (a, b) => a.average - b.average || moduleTitle(a.topic).localeCompare(moduleTitle(b.topic), 'el'),
                  );
                if (!rows.length) return null;
                return (
                  <div key={kind} className="studio-ratings-group">
                    <h3>
                      {L(el, en)} <span>{rows.length}</span>
                    </h3>
                    <ul className="studio-errors-list">
                      {rows.map(r => (
                        <li key={r.topic} className="studio-rating-row">
                          <span className="studio-rating-title">{moduleTitle(r.topic)}</span>
                          <span className="studio-rating-bar" aria-hidden="true">
                            <i style={{width: `${(r.average / 5) * 100}%`}} className={r.average < 3 ? 'low' : ''} />
                          </span>
                          <b>{stars(r.average)}</b>
                          <small>
                            {r.count} {r.count === 1 ? L('βαθμολογία', 'rating') : L('βαθμολογίες', 'ratings')}
                          </small>
                          {r.comments.length > 0 && (
                            <div className="studio-rating-comments">
                              {r.comments.map((c, i) => (
                                <span key={i} className="studio-rating-comment">
                                  <q>{c.text}</q>
                                  {!demoId && <cite>{c.hospital}</cite>}
                                </span>
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {summary.evaluations.length > 0 && (
                <div className="studio-ratings-group">
                  <h3>
                    {L('Τελικές αξιολογήσεις', 'Final evaluations')} <span>{summary.evaluations.length}</span>
                  </h3>
                  <ul className="studio-errors-list">
                    {summary.evaluations.map((e, i) => (
                      <li key={i} className="studio-rating-final">
                        <div>
                          <b>{e.name || '—'}</b>
                          <small>{e.hospital}</small>
                        </div>
                        <div className="studio-rating-final-scores">
                          {e.nps !== null && (
                            <span className={`evaluation-demo-nps ${npsGroup(e.nps).toLowerCase()}`}>
                              {L(`Σύσταση ${e.nps}/10`, `Recommend ${e.nps}/10`)}
                            </span>
                          )}
                          {e.ease !== undefined && (
                            <span>
                              <Star size={13} /> {L(`Ευκολία ${e.ease}/5`, `Ease ${e.ease}/5`)}
                            </span>
                          )}
                          {e.fit !== undefined && (
                            <span>
                              <Star size={13} /> {L(`Ταιριάζει ${e.fit}/5`, `Fit ${e.fit}/5`)}
                            </span>
                          )}
                          {(e.sets !== undefined || e.theatres !== undefined) && (
                            <span>
                              {L(
                                `Σετ ${e.sets ?? '—'} · Αίθουσες ${e.theatres ?? '—'}`,
                                `Sets ${e.sets ?? '—'} · Theatres ${e.theatres ?? '—'}`,
                              )}
                            </span>
                          )}
                        </div>
                        {e.missing && <q>{L(`Λείπει: ${e.missing}`, `Missing: ${e.missing}`)}</q>}
                        {e.comment && <q>{e.comment}</q>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
