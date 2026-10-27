/**
 * The Studio sections only the platform owner works in: the Sterilization flow and the roles & permissions.
 * A hospital admin keeps the libraries (their own departments, specialties, sterilizers…) and the settings,
 * and does not see these in the menu, nor reach them by their address.
 */
const OWNER_ONLY_TABS = ['workflow', 'roles'];

/** A Studio section (the `tab` of the address, or a Studio tab id) that is the platform owner's. */
export const isOwnerOnlyTab = (tab: string | null | undefined) => !!tab && OWNER_ONLY_TABS.includes(tab.toLowerCase());

/** A menu address («/studio?tab=roles») of one of those sections. */
export const isOwnerOnlyPath = (to: string) => {
  const [path, query = ''] = to.split('?');
  return path === '/studio' && isOwnerOnlyTab(new URLSearchParams(query).get('tab'));
};
