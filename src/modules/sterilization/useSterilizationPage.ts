import {useSterilizationState} from './hooks/useSterilizationState';
import {useSterilizationQueues} from './hooks/useSterilizationQueues';
import {usePreparationChecks} from './hooks/usePreparationChecks';
import {useIssueReport} from './hooks/useIssueReport';
import {useReceiptFlow} from './hooks/useReceiptFlow';
import {usePreparationFlow} from './hooks/usePreparationFlow';
import {useCycleFlow} from './hooks/useCycleFlow';
import {useLoadFlow} from './hooks/useLoadFlow';
import {useDeliveryFlow} from './hooks/useDeliveryFlow';
import {useScanFlow} from './hooks/useScanFlow';

/**
 * Everything the Sterilization screen needs, built flow by flow. Each hook gets what the ones before it
 * returned, so the order below is the order of dependency (and of the original component's hooks).
 */
export function useSterilizationPage() {
  const s0 = useSterilizationState();
  const s1 = {...s0, ...useSterilizationQueues(s0)};
  const s2 = {...s1, ...usePreparationChecks(s1)};
  const s3 = {...s2, ...useIssueReport(s2)};
  const s4 = {...s3, ...useReceiptFlow(s3)};
  const s5 = {...s4, ...usePreparationFlow(s4)};
  const s6 = {...s5, ...useCycleFlow(s5)};
  const s7 = {...s6, ...useLoadFlow(s6)};
  const s8 = {...s7, ...useDeliveryFlow(s7)};
  const s9 = {...s8, ...useScanFlow(s8)};
  return s9;
}

export type SterilizationPageState = ReturnType<typeof useSterilizationPage>;
