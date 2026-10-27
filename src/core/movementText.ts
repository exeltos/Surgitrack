import {trData} from '../i18n';

/** The id of the account some entries name in their text, for the audit trail: «… · Νίκος (5b39fe1b-5730-…) · …». */
const ACCOUNT_ID = /\s*\([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\)/gi;

/** A movement's text as the screens show it: translated, without the internal account id (kept in the record). */
export const movementText = (status: string) => trData(status.replace(ACCOUNT_ID, ''));
