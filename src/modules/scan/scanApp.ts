/** Where the scanning app lives in the router. */
export const SCAN_PATH = '/scan';

/**
 * Opened as the phone app (scan.html, installed from the browser to the home screen): only the scanning
 * stations, with its own sign-in, and never the rest of SurgiTrack.
 */
export const isScanStandalone = () => /\/scan\.html$/.test(window.location.pathname);

/** On the scanning screens now, either as the phone app or from the «Σάρωση» button of the full app. */
export const onScanScreens = () =>
  isScanStandalone() || window.location.hash === `#${SCAN_PATH}` || window.location.hash.startsWith(`#${SCAN_PATH}/`);
