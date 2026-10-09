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
  status: 'PREPARING' | 'SENT';
  maxExtraUsers: number;
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
  /** The latest load of the sample hospital: first fill or reset. */
  lastLoad?: {kind: 'SEED' | 'RESET'; at: string; records: number};
};

/**
 * PREPARING: the sample data or the invitation is still to come. INVITED: the email went out, not
 * signed in yet. ACTIVE: the prospect is in. ENDED: past its end date (the database locks it).
 */
export type DemoStage = 'PREPARING' | 'INVITED' | 'ACTIVE' | 'ENDED';

export const demoStage = (demo: Pick<DemoAccount, 'status' | 'endsAt' | 'evaluatorActive'>, now = Date.now()) => {
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
