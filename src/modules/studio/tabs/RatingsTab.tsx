import {useCallback, useEffect, useMemo, useState} from 'react';
import {MessageSquareHeart, RefreshCw} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import Spinner from '../../../components/ui/Spinner';
import type {DemoAccount} from '../../../core/demoAccounts';
import {summarizeRatings} from '../../../core/demoRatings';
import {loadDemoAccounts} from '../../../data/cloud/demoAccounts';
import {stars} from '../demo/ratingTitles';
import RatingsView from '../demo/RatingsView';
import type {StudioPageState} from '../useStudioPage';

/**
 * The platform owner's view of what the evaluation Demos think: the final evaluations with the NPS first,
 * then every rating by part of the app or by Demo, each with its comment, person, hospital and date.
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
              <small>{L('Αγορά ή παράταση · Demo αξιολόγησης', 'Purchase or more time · Evaluation Demos')}</small>
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
            <RatingsView demos={shown} L={L} />
          )}
        </>
      )}
    </section>
  );
}
