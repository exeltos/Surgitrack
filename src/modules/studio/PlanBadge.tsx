import {type Organization} from '../../core/LibraryStore';
import {trialState} from '../../core/trial';

export default function PlanBadge({org, L}: {org: Organization; L: (el: string, en: string) => string}) {
  if (org.plan !== 'TRIAL') return <span className="plan-badge standard">{L('Κανονική χρήση', 'Standard use')}</span>;
  const state = trialState(org.plan, org.trialEndsAt);
  const date = org.trialEndsAt ? new Date(org.trialEndsAt).toLocaleDateString('el-GR') : '—';
  if (state.ended)
    return (
      <span className="plan-badge locked">
        {L(`Δοκιμή έληξε ${date} · κλειδωμένο`, `Trial ended ${date} · locked`)}
      </span>
    );
  return (
    <span className={`plan-badge trial${state.warn ? ' warn' : ''}`}>
      {L(`Δοκιμαστική · λήγει ${date} (${state.daysLeft} ημέρες)`, `Trial · ends ${date} (${state.daysLeft} days)`)}
    </span>
  );
}
