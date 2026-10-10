/**
 * Evaluation Demos: a prospect's own Demo hospital, opened by the platform owner from Studio. These
 * helpers say where each Demo stands; the database and the demo-account function do the work.
 */
import {trialDaysLeft} from './trial';

/** Lengths offered when opening a Demo; 14 days unless the owner picks another length or date. */
export const DEMO_LENGTHS = [7, 14, 30] as const;
export const DEFAULT_DEMO_DAYS = 14;
/** Days added by one press of "extend". */
export const DEMO_EXTENSION_DAYS = 7;
/** An ended Demo is deleted this many days after its end (demo-lifecycle), unless kept. */
export const DEMO_DELETE_AFTER_DAYS = 30;

export type DemoAccount = {
  id: string;
  organizationId: string;
  organizationName: string;
  code: string;
  hospitalName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  notes?: string;
  status: 'PREPARING' | 'SENT' | 'CONVERTED';
  maxExtraUsers: number;
  /** Deleted 30 days after its end; the owner can keep it. */
  autoDelete: boolean;
  /** When it became a customer hospital. */
  convertedAt?: string;
  endsAt?: string;
  active: boolean;
  seededAt?: string;
  invitedAt?: string;
  createdAt: string;
  evaluatorId?: string;
  /** The prospect has set a password and signed in. */
  evaluatorActive: boolean;
  evaluatorCode?: string;
  /** Accounts in the Demo besides the prospect's. */
  extraUsers: number;
  /** Those accounts, for the owner's view. */
  colleagues: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
    userCode?: string;
    /** First-steps guide: steps done of those for their role. */
    guide: {done: number; total: number};
  }>;
  /** The prospect's own first-steps progress. */
  evaluatorGuide?: {done: number; total: number};
  /** Average 1–5 rating of each part of the app, over everyone who rated it. */
  /** Per part of the app or per guide step (topic `step_<key>`), with the comments left with them. */
  ratings: Array<{topic: string; average: number; count: number; comments: string[]}>;
  /** Final evaluations, one per person who sent one. */
  evaluations: Array<{
    name: string;
    nps: number | null;
    ease?: number;
    fit?: number;
    missing?: string;
    sets?: number;
    theatres?: number;
    comment?: string;
  }>;
  /** "I want the application" / "Ask for more time", newest first. */
  requests: Array<{
    id: string;
    kind: 'PURCHASE' | 'EXTENSION';
    name: string;
    phone?: string;
    message?: string;
    status: 'NEW' | 'HANDLED';
    createdAt: string;
  }>;
  /** The latest load of the sample hospital: first fill or reset. */
  lastLoad?: {kind: 'SEED' | 'RESET'; at: string; records: number};
};

/**
 * PREPARING: the sample data or the invitation is still to come. INVITED: the email went out, not
 * signed in yet. ACTIVE: the prospect is in. ENDED: past its end date (the database locks it).
 * CONVERTED: it became a customer hospital.
 */
export type DemoStage = 'PREPARING' | 'INVITED' | 'ACTIVE' | 'ENDED' | 'CONVERTED';

export const demoStage = (demo: Pick<DemoAccount, 'status' | 'endsAt' | 'evaluatorActive'>, now = Date.now()) => {
  if (demo.status === 'CONVERTED') return 'CONVERTED' as const;
  if (demo.endsAt && Date.parse(demo.endsAt) <= now) return 'ENDED' as const;
  if (demo.status === 'PREPARING') return 'PREPARING' as const;
  return demo.evaluatorActive ? ('ACTIVE' as const) : ('INVITED' as const);
};

/** Whole days left, counting today; 0 once ended. */
export const demoDaysLeft = (demo: Pick<DemoAccount, 'endsAt'>, now = Date.now()) =>
  trialDaysLeft(demo.endsAt, now) ?? 0;

/** What preparation still needs: the sample data first, then the email. */
export const demoNextStep = (demo: Pick<DemoAccount, 'seededAt' | 'status'>) =>
  !demo.seededAt ? ('SEED' as const) : demo.status === 'PREPARING' ? ('INVITE' as const) : null;

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/** When the daily round deletes this Demo, if it will. */
export const demoDeleteOn = (demo: Pick<DemoAccount, 'status' | 'endsAt' | 'autoDelete'>) =>
  demo.status === 'CONVERTED' || !demo.autoDelete || !demo.endsAt
    ? undefined
    : new Date(Date.parse(demo.endsAt) + DEMO_DELETE_AFTER_DAYS * 864e5).toISOString();

/**
 * How far the Demos went, each step counting the Demos that reached it: opened, email sent, the
 * prospect signed in, someone tried a first step, someone evaluated it, someone asked for the
 * application, became a customer. With the average "would recommend" (0–10) over all evaluations.
 */
export const demoFunnel = (demos: DemoAccount[]) => {
  const tried = (d: DemoAccount) => (d.evaluatorGuide?.done || 0) > 0 || d.colleagues.some(c => c.guide.done > 0);
  const nps = demos.flatMap(d => d.evaluations.map(e => e.nps)).filter((n): n is number => n !== null);
  return {
    steps: [
      {key: 'opened', count: demos.length},
      {key: 'sent', count: demos.filter(d => d.status !== 'PREPARING').length},
      {key: 'signedIn', count: demos.filter(d => d.evaluatorActive || d.status === 'CONVERTED').length},
      {key: 'tried', count: demos.filter(tried).length},
      {key: 'evaluated', count: demos.filter(d => d.evaluations.length > 0).length},
      {key: 'wanted', count: demos.filter(d => d.requests.some(r => r.kind === 'PURCHASE')).length},
      {key: 'converted', count: demos.filter(d => d.status === 'CONVERTED').length},
    ] as const,
    averageNps: nps.length ? nps.reduce((a, b) => a + b, 0) / nps.length : undefined,
  };
};
