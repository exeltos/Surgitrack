import {tr} from '../i18n';
import {isNoCode} from './nameCheck';

export {isNoCode};

/** The code as stored: a «no code» is stored empty, so it is written one way everywhere. */
export const normalizeCode = (code: string) => (isNoCode(code) ? '' : code.trim());

/** The code as shown: «Χωρίς κωδικό» when there is none. */
export const codeLabel = (code: string | undefined | null) => (isNoCode(code) ? tr('Χωρίς κωδικό') : code!.trim());
