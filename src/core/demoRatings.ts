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

/** The parts of the app a rating can be about, in the order the owner reads them; «Άλλες οθόνες» last. */
export const RATING_PARTS = [
  {key: 'sterilization', el: 'Ροή Αποστείρωσης', en: 'Sterilization workflow'},
  {key: 'department', el: 'Τμήματα', en: 'Departments'},
  {key: 'traceability', el: 'Ιχνηλασιμότητα', en: 'Traceability'},
  {key: 'reports', el: 'Αναφορές', en: 'Reports'},
  {key: 'users', el: 'Χρήστες', en: 'Users'},
  {key: 'other', el: 'Άλλες οθόνες', en: 'Other screens'},
] as const;
export type RatingPart = (typeof RATING_PARTS)[number]['key'];

/** The guide steps of each part (as in demoFeedback's MODULES). */
const STEPS_OF: Record<string, RatingPart> = {
  receive: 'sterilization',
  prepare: 'sterilization',
  cycle: 'sterilization',
  release: 'sterilization',
  deliver: 'sterilization',
  department: 'department',
  dispatch: 'department',
  count: 'department',
  issue: 'department',
  history: 'department',
  trace: 'traceability',
  reports: 'reports',
  overview: 'reports',
  invite: 'users',
};
/** The screens of each part; other screens are «Άλλες οθόνες». */
const SCREENS_OF: Record<string, RatingPart> = {
  sterilization: 'sterilization',
  department: 'department',
  traceability: 'traceability',
  movements: 'traceability',
  reports: 'reports',
  overview: 'reports',
  hospital: 'users',
};

/** The part of the app a rating topic is about: a part itself, or a step, tour or screen of it. */
export const ratingPart = (topic: string): RatingPart => {
  if (RATING_PARTS.some(p => p.key === topic)) return topic as RatingPart;
  if (topic.startsWith('step_')) return STEPS_OF[topic.slice(5)] || 'other';
  if (topic.startsWith('tour_')) return STEPS_OF[topic.slice(5)] || 'other';
  if (topic.startsWith('screen_')) return SCREENS_OF[topic.slice(7)] || 'other';
  return 'other';
};

export type RatingEntry = {
  topic: string;
  part: RatingPart;
  hospital: string;
  demoId: string;
  name: string;
  rating: number;
  comment?: string;
  at?: string;
};

const newestFirst = (a: {at?: string}, b: {at?: string}) =>
  (Date.parse(b.at || '') || 0) - (Date.parse(a.at || '') || 0);

/** Every single rating of these Demos, newest first, with its part of the app, person and hospital. */
export const ratingEntries = (demos: DemoAccount[]): RatingEntry[] =>
  demos
    .flatMap(demo =>
      (demo.feedback || []).map(f => ({
        ...f,
        part: ratingPart(f.topic),
        hospital: demo.hospitalName,
        demoId: demo.id,
      })),
    )
    .sort(newestFirst);

/**
 * The ratings by part of the app: each part's average over every rating of its own, its steps, tours and
 * screens, and its ratings newest first. Parts rated below 3 come first, as they need attention.
 */
export function ratingsByPart(demos: DemoAccount[]) {
  const entries = ratingEntries(demos);
  return RATING_PARTS.map(part => {
    const mine = entries.filter(e => e.part === part.key);
    const average = mine.length ? mine.reduce((sum, e) => sum + e.rating, 0) / mine.length : 0;
    return {...part, average, count: mine.length, entries: mine};
  })
    .filter(part => part.count > 0)
    .sort((a, b) => Number(a.average >= 3) - Number(b.average >= 3));
}

/** The final evaluations of these Demos, newest first, with their hospital. */
export const finalEvaluations = (demos: DemoAccount[]) =>
  demos
    .flatMap(demo => demo.evaluations.map(e => ({...e, hospital: demo.hospitalName, demoId: demo.id})))
    .sort(newestFirst);
