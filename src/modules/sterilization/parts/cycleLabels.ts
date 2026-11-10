import type {CyclePhase} from '../../../core/cycleSimulator';
import {tr} from '../../../i18n';

/** The phase of a cycle as the screens name it. */
export const phaseText = (phase: CyclePhase) =>
  phase === 'HEATING'
    ? tr('Προθέρμανση')
    : phase === 'HOLDING'
      ? tr('Αποστείρωση')
      : phase === 'DRYING'
        ? tr('Στέγνωμα')
        : phase === 'ABORTED'
          ? tr('Διακοπή κύκλου')
          : tr('Ολοκληρώθηκε');
