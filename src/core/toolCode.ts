import {tr} from '../i18n';
import {cleanName} from './nameCheck';

/**
 * An instrument's code: none typed, or a «no code» written in any of the ways people write it («ΧΩΡΙΣ ΚΩΔΙΚΟ»,
 * «XΩΡΙΣ ΚΩΔΙΚΟΣ» with a Latin X, «χωρίς κωδικό»…). All of them are one thing: no code.
 */
export const isNoCode = (code: string | undefined | null) => !code?.trim() || /^ΧΩΡΙΣ ΚΩΔΙΚ/.test(cleanName(code));

/** The code as stored: a «no code» is stored empty, so it is written one way everywhere. */
export const normalizeCode = (code: string) => (isNoCode(code) ? '' : code.trim());

/** The code as shown: «Χωρίς κωδικό» when there is none. */
export const codeLabel = (code: string | undefined | null) => (isNoCode(code) ? tr('Χωρίς κωδικό') : code!.trim());
