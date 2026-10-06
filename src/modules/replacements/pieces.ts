import {tr} from '../../i18n';

export const pieces = (count: number) => (count === 1 ? tr('1 τεμάχιο') : tr('{0} τεμάχια', count));
