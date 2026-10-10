import {tr} from '../i18n';

/**
 * How people name a load: its sterilizer or washer and its cycle number. The load's own id (L…) is for the
 * records (history, printed release form), not for the screen.
 */
export const loadLabel = (load: {equipment?: string; cycleNumber?: string}) =>
  tr('{0} · κύκλος {1}', load.equipment || '—', load.cycleNumber || '—');
