import {type Organization} from '../../core/LibraryStore';
import {trialState} from '../../core/trial';
import {formatDate} from '../../core/displayDate';

export default function PlanBadge({org, L}: {org: Organization; L: (el: string, en: string) => string}) {
  if (org.plan !== 'TRIAL') return <span className="plan-badge standard">{L('Κανονική χρήση', 'Standard use')}</span>;
  const state = trialState(org.plan, org.trialEndsAt);
  const date = org.trialEndsAt ? formatDate(org.trialEndsAt) : '—';
  if (state.ended)
    return (
      <span className="plan-badge locked" title={L(`Η δοκιμή έληξε ${date}`, `The trial ended ${date}`)}>
        {L('Έληξε · κλειδωμένο', 'Ended · locked')}
      </span>
    );
  return (
    <span
      className={`plan-badge trial${state.warn ? ' warn' : ''}`}
      title={L(`Δοκιμαστική περίοδος έως ${date}`, `On trial until ${date}`)}
    >
      {L(`Δοκιμή · ${state.daysLeft} ημ.`, `Trial · ${state.daysLeft} d`)}
    </span>
  );
}
