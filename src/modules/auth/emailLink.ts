/**
 * What an emailed link carries: `?st_token=<token hash>&st_link=invite|recovery` (not "type=", which
 * the client would take for a link it has already used).
 */
export const emailLink = (): {token: string; type: 'invite' | 'recovery'} | undefined => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('st_token');
  const type = params.get('st_link');
  return token && (type === 'invite' || type === 'recovery') ? {token, type} : undefined;
};
