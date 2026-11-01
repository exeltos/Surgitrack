import {helpManual} from '../../core/help/helpManual';
import type {Permission} from '../../core/permissions';

/** The manual section of a menu screen, if this person may open it. */
export const screenSection = (pathname: string, can: (p: Permission) => boolean) =>
  helpManual.find(s => !s.guide && !s.detailOf && s.to === pathname && (!s.permission || can(s.permission)));
