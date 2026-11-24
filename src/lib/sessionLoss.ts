/**
 * A tab whose session ended without the app noticing (signed out in another tab, a refresh that failed while the
 * computer slept) keeps asking for the hospital's tables with only the publishable key: the server answers 401
 * every minute, the screen shows an old copy and nothing it saves arrives. The first such answer is reported once,
 * so the app can end the session in this tab too and show the sign-in screen (unsaved work is kept for after it).
 */
export function watchSessionLoss(fetchImpl: typeof fetch, publishableKey: string, onLost: () => void): typeof fetch {
  let reported = false;
  return async (input, init) => {
    const response = await fetchImpl(input, init);
    if (response.status !== 401 || reported) return response;
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('/rest/v1/')) return response;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    // Only a request without a user's token: a user's expired token is the client's own to refresh.
    if (headers.get('Authorization') !== `Bearer ${publishableKey}`) return response;
    reported = true;
    onLost();
    return response;
  };
}
