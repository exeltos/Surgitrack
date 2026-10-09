/**
 * What a prospect thinks of SurgiTrack: a 1–5 rating for each part of the app they have tried,
 * and one final evaluation. The guide's steps say which parts they have tried.
 */
import type {GuideStep} from './demoGuide';

export type Module = {key: string; title: {el: string; en: string}; steps: string[]};

export const MODULES: Module[] = [
  {
    key: 'sterilization',
    title: {el: 'Ροή Αποστείρωσης', en: 'Sterilization workflow'},
    steps: ['receive', 'prepare', 'cycle', 'release', 'deliver'],
  },
  {
    key: 'department',
    title: {el: 'Τμήματα', en: 'Departments'},
    steps: ['department', 'dispatch', 'count', 'issue', 'history'],
  },
  {key: 'traceability', title: {el: 'Ιχνηλασιμότητα', en: 'Traceability'}, steps: ['trace']},
  {key: 'reports', title: {el: 'Αναφορές', en: 'Reports'}, steps: ['reports', 'overview']},
  {key: 'users', title: {el: 'Χρήστες', en: 'Users'}, steps: ['invite']},
];

/** The parts of the app this person can rate: those of their steps, once one of them is done. */
export const modulesToRate = (steps: GuideStep[], done: ReadonlySet<string>) => {
  const mine = new Set(steps.map(s => s.key));
  return MODULES.filter(m => m.steps.some(k => mine.has(k)) && m.steps.some(k => done.has(k)));
};

export const FINAL_TOPIC = 'final';

export type FinalAnswers = {ease?: number; fit?: number; missing?: string; sets?: number; theatres?: number};

/** The final evaluation is offered when most of the guide is done, or in the Demo's last days. */
export const suggestFinal = (progress: {done: number; total: number}, daysLeft: number) =>
  progress.total > 0 && (progress.done / progress.total >= 0.8 || daysLeft <= 3);

/** NPS group of one answer: 9–10 promoter, 7–8 passive, 0–6 detractor. */
export const npsGroup = (nps: number) => (nps >= 9 ? 'PROMOTER' : nps >= 7 ? 'PASSIVE' : 'DETRACTOR');
