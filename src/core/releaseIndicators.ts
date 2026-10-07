import type {BiologicalIndicatorResult, SterilizationIndicatorResult} from '../types/domain';
import type {SterilizationWorkflowConfig} from './workflow';

export type ReleasePolicy = SterilizationWorkflowConfig['releasePolicy'];

export type IndicatorVerdict =
  {ok: true} | {ok: false; reason: 'FAILED' | 'CHEMICAL_REQUIRED' | 'BIOLOGICAL_REQUIRED' | 'NEEDS_ONE'};

/**
 * Whether the two indicators of a load allow its release. Either one is enough, as the unit decides, and
 * a failed one always blocks. The unit's policy can additionally require the chemical indicator or the
 * biological one (a pending biological result counts only where the policy allows releasing while it waits).
 * «Δεν έγινε» is `NOT_RECORDED` for the chemical and `NOT_REQUIRED` for the biological indicator.
 */
export function releaseIndicatorVerdict(
  policy: ReleasePolicy,
  chemical: SterilizationIndicatorResult,
  biological: BiologicalIndicatorResult,
): IndicatorVerdict {
  if (chemical === 'FAIL' || biological === 'FAIL') return {ok: false, reason: 'FAILED'};
  if (policy.requireChemicalIndicator && chemical !== 'PASS') return {ok: false, reason: 'CHEMICAL_REQUIRED'};
  const biologicalWaitingOk = policy.allowReleaseWhileBiPending && biological === 'PENDING';
  if (policy.biologicalIndicator === 'REQUIRED' && biological !== 'PASS' && !biologicalWaitingOk)
    return {ok: false, reason: 'BIOLOGICAL_REQUIRED'};
  if (chemical !== 'PASS' && biological !== 'PASS') return {ok: false, reason: 'NEEDS_ONE'};
  return {ok: true};
}
