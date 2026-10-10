import type {DemoAccount} from './demoAccounts';
import {npsGroup} from './demoFeedback';

/** What a rating is about: a first step, its guided tour, a screen, or a part of the app. */
export type RatingKind = 'STEP' | 'TOUR' | 'SCREEN' | 'MODULE';
export const ratingKind = (topic: string): RatingKind =>
  topic.startsWith('tour_')
    ? 'TOUR'
    : topic.startsWith('screen_')
      ? 'SCREEN'
      : topic.startsWith('step_')
        ? 'STEP'
        : 'MODULE';

export type RatingSummary = {
  topic: string;
  kind: RatingKind;
  average: number;
  count: number;
  comments: Array<{hospital: string; text: string}>;
};

/**
 * Every Demo's ratings together, for the platform owner: per topic the average over everyone who rated it
 * (weighted by how many did, in each Demo), the comments with their hospital, the final evaluations with
 * the NPS (promoters minus detractors, in %), and the requests still waiting.
 */
export function summarizeRatings(demos: DemoAccount[]) {
  const byTopic = new Map<string, RatingSummary>();
  for (const demo of demos)
    for (const r of demo.ratings) {
      const entry = byTopic.get(r.topic) || {
        topic: r.topic,
        kind: ratingKind(r.topic),
        average: 0,
        count: 0,
        comments: [],
      };
      const count = entry.count + r.count;
      entry.average = (entry.average * entry.count + r.average * r.count) / count;
      entry.count = count;
      entry.comments.push(...r.comments.map(text => ({hospital: demo.hospitalName, text})));
      byTopic.set(r.topic, entry);
    }
  const ratings = [...byTopic.values()];
  const evaluations = demos.flatMap(demo => demo.evaluations.map(e => ({...e, hospital: demo.hospitalName})));
  const scored = evaluations.filter(e => e.nps !== null) as Array<(typeof evaluations)[number] & {nps: number}>;
  const share = (group: 'PROMOTER' | 'DETRACTOR') =>
    scored.filter(e => npsGroup(e.nps) === group).length / Math.max(1, scored.length);
  const rated = ratings.reduce((sum, r) => sum + r.count, 0);
  return {
    ratings,
    evaluations,
    /** Average of every rating given (1–5); none before the first. */
    average: rated ? ratings.reduce((sum, r) => sum + r.average * r.count, 0) / rated : undefined,
    rated,
    nps: scored.length ? Math.round((share('PROMOTER') - share('DETRACTOR')) * 100) : undefined,
    newRequests: demos.reduce((sum, demo) => sum + demo.requests.filter(r => r.status === 'NEW').length, 0),
  };
}
