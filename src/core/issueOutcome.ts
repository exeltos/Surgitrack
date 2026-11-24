import type {Issue} from '../types/domain';

/**
 * A report closed by withdrawing the instrument: not «resolved» but «withdrawn». Older reports carry no outcome,
 * only the text their resolution added («Επίλυση: Αποσύρθηκε (…)»).
 */
export const issueWithdrawn = (issue: Pick<Issue, 'status' | 'outcome' | 'note'>) =>
  issue.status === 'RESOLVED' && (issue.outcome === 'RETIRED' || /Επίλυση: Αποσύρθηκε/.test(issue.note));
