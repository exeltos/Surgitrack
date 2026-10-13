import {useState} from 'react';
import {ChevronDown, Star} from 'lucide-react';
import type {DemoAccount} from '../../../core/demoAccounts';
import {npsGroup} from '../../../core/demoFeedback';
import {finalEvaluations, ratingEntries, ratingsByPart, type RatingEntry} from '../../../core/demoRatings';
import {formatDate} from '../../../core/displayDate';
import {moduleTitle, stars} from './ratingTitles';

/** Who, where and when: «Μαρία Παππά · Γ.Ν. Λάρισας · 12/10/2026» (the hospital only across Demos). */
const byline = (e: {name: string; hospital: string; at?: string}, withHospital: boolean) =>
  [e.name, withHospital && e.hospital, e.at && formatDate(e.at)].filter(Boolean).join(' · ');

/** One rating: what it was about, its stars, the comment, and who gave it when. */
function Entry({e, withHospital}: {e: RatingEntry; withHospital: boolean}) {
  return (
    <li className="rating-entry">
      <div>
        <span className="rating-entry-subject">{moduleTitle(e.topic)}</span>
        <b className={e.rating < 3 ? 'low' : ''}>{'★'.repeat(e.rating)}</b>
      </div>
      {e.comment && <q>{e.comment}</q>}
      <small>{byline(e, withHospital)}</small>
    </li>
  );
}

/**
 * What the Demos' people think: the final evaluations first (one per person), then every rating either by
 * part of the app (its average; open it for each rating with its comment, person and date) or by Demo and
 * person. `single` is one Demo's own view (no hospital, no «by Demo»).
 */
export default function RatingsView({
  demos,
  L,
  single = false,
}: {
  demos: DemoAccount[];
  L: (el: string, en: string) => string;
  single?: boolean;
}) {
  const [view, setView] = useState<'PART' | 'DEMO'>('PART');
  const [open, setOpen] = useState<string | null>(null);
  const finals = finalEvaluations(demos);
  const parts = ratingsByPart(demos);
  const withHospital = !single;
  if (!finals.length && !parts.length) return null;
  return (
    <div className="ratings-view">
      {finals.length > 0 && (
        <section className="ratings-view-group" aria-label={L('Τελικές αξιολογήσεις', 'Final evaluations')}>
          <h3>
            {L('Τελικές αξιολογήσεις', 'Final evaluations')} <span>{finals.length}</span>
          </h3>
          <ul className="ratings-finals">
            {finals.map((e, i) => (
              <li key={i}>
                <div className="ratings-final-head">
                  <b>{e.name || '—'}</b>
                  <small>{[withHospital && e.hospital, e.at && formatDate(e.at)].filter(Boolean).join(' · ')}</small>
                </div>
                <div className="ratings-final-scores">
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
        </section>
      )}
      {parts.length > 0 && (
        <section className="ratings-view-group" aria-label={L('Βαθμολογίες', 'Ratings')}>
          <div className="ratings-view-head">
            <h3>
              {L('Βαθμολογίες', 'Ratings')} <span>{parts.reduce((n, p) => n + p.count, 0)}</span>
            </h3>
            {!single && (
              <div className="name-check-tabs ratings-view-switch" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'PART'}
                  className={view === 'PART' ? 'active' : ''}
                  onClick={() => setView('PART')}
                >
                  {L('Ανά λειτουργία', 'By part of the app')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'DEMO'}
                  className={view === 'DEMO' ? 'active' : ''}
                  onClick={() => setView('DEMO')}
                >
                  {L('Ανά Demo', 'By Demo')}
                </button>
              </div>
            )}
          </div>
          {view === 'PART' || single ? (
            <ul className="ratings-parts">
              {parts.map(part => {
                const expanded = open === part.key;
                return (
                  <li key={part.key} className={part.average < 3 ? 'low' : ''}>
                    <button
                      type="button"
                      className="ratings-part-row"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : part.key)}
                    >
                      <span className="ratings-part-title">{L(part.el, part.en)}</span>
                      <span className="studio-rating-bar" aria-hidden="true">
                        <i style={{width: `${(part.average / 5) * 100}%`}} className={part.average < 3 ? 'low' : ''} />
                      </span>
                      <b>{stars(part.average)}</b>
                      <small>
                        {part.count} {part.count === 1 ? L('βαθμολογία', 'rating') : L('βαθμολογίες', 'ratings')}
                      </small>
                      <ChevronDown size={16} className="ratings-part-open" />
                    </button>
                    {expanded && (
                      <ul className="rating-entries">
                        {part.entries.map((e, i) => (
                          <Entry key={i} e={e} withHospital={withHospital} />
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="ratings-demos">
              {demos
                .map(demo => ({demo, entries: ratingEntries([demo])}))
                .filter(d => d.entries.length)
                .map(({demo, entries}) => {
                  const people = [...new Set(entries.map(e => e.name))];
                  return (
                    <li key={demo.id}>
                      <h4>{demo.hospitalName}</h4>
                      {people.map(person => (
                        <div key={person} className="ratings-person">
                          <strong>{person || '—'}</strong>
                          <ul className="rating-entries">
                            {entries
                              .filter(e => e.name === person)
                              .map((e, i) => (
                                <Entry key={i} e={{...e, name: ''}} withHospital={false} />
                              ))}
                          </ul>
                        </div>
                      ))}
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
