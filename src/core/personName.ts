import {tr} from '../i18n';

/**
 * The platform owner's account has no name of its own («Platform Admin», department «Platform»): shown in the app's
 * language wherever a person is named (the account menu, a printed form).
 */
export const personName = (name: string) => (name === 'Platform Admin' ? tr('Διαχειριστής πλατφόρμας') : name);
export const personDepartment = (department: string) => (department === 'Platform' ? tr('Πλατφόρμα') : department);
