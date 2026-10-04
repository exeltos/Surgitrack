/**
 * Trial hospitals: opened for a number of days, then locked until the platform owner extends the
 * trial or turns the hospital into standard use. The database enforces the lock; these helpers say
 * what the screens show.
 */

export type HospitalPlan = 'STANDARD' | 'TRIAL';

/** From this many days before the end, every user of the hospital sees how many days are left. */
export const TRIAL_WARNING_DAYS = 7;
export const TRIAL_LENGTHS = [14, 30, 60, 90] as const;

const DAY = 864e5;

/** The end of a trial that starts now and lasts `days`: the end of that day, local time. */
export const trialEndAfter = (days: number, from = new Date()) => {
  const end = new Date(from.getTime() + days * DAY);
  end.setHours(23, 59, 59, 0);
  return end.toISOString();
};

/** The end of the given local date (yyyy-mm-dd), as stored. */
export const trialEndOn = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
};

/** The local yyyy-mm-dd of a stored end, for a date field. */
export const trialEndDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const trialEnded = (plan: HospitalPlan | undefined, endsAt: string | undefined, now = Date.now()) =>
  plan === 'TRIAL' && !!endsAt && Date.parse(endsAt) <= now;

/** Whole days left, counting today; 0 once ended. */
export const trialDaysLeft = (endsAt: string | undefined, now = Date.now()) =>
  endsAt ? Math.max(0, Math.ceil((Date.parse(endsAt) - now) / DAY)) : undefined;

export type TrialState = {plan: HospitalPlan; endsAt?: string; ended: boolean; daysLeft?: number; warn: boolean};

export const trialState = (
  plan: HospitalPlan | undefined,
  endsAt: string | undefined,
  now = Date.now(),
): TrialState => {
  const p = plan || 'STANDARD';
  const ended = trialEnded(p, endsAt, now);
  const daysLeft = p === 'TRIAL' ? trialDaysLeft(endsAt, now) : undefined;
  return {
    plan: p,
    endsAt,
    ended,
    daysLeft,
    warn: p === 'TRIAL' && !ended && daysLeft !== undefined && daysLeft <= TRIAL_WARNING_DAYS,
  };
};
