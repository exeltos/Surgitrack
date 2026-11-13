import {useEffect, useRef, useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {HANDOVER_PASS_PREFIX, requestHandoverPass} from '../../data/cloud/handover';
import {tr, trData} from '../../i18n';
import {useSurgi} from '../../store/SurgiStore';
import {ScanScreen} from './ScanParts';

/** How often the phone asks for a new pass (each lives 45 seconds on the server). */
const REFRESH_SECONDS = 30;

/** The QR of a text, as SVG markup (drawn by the same library that reads barcodes, loaded on first use). */
async function qrSvg(text: string): Promise<string> {
  const {BrowserQRCodeSvgWriter} = await import('@zxing/library');
  const svg = new BrowserQRCodeSvgWriter().write(text, 260, 260);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', tr('QR υπογραφής παράδοσης'));
  return svg.outerHTML;
}

/**
 * «Το QR μου»: the signed-in person shows it at a handover and Sterilization scans it instead of asking for
 * their username and password. It holds a one-time pass that changes every 30 seconds, so a photo of it is
 * of no use a minute later, and it works once.
 */
export default function MyPass({onStations}: {onStations: () => void}) {
  const {currentUser} = useSurgi();
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);
  const [left, setLeft] = useState(REFRESH_SECONDS);
  const [round, setRound] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let timer = 0;
    const load = async () => {
      setFailed(false);
      const pass = await requestHandoverPass(currentUser.department);
      if (!alive.current) return;
      if (!pass) {
        setFailed(true);
        setSvg('');
        return;
      }
      setSvg(await qrSvg(`${HANDOVER_PASS_PREFIX}${pass.pass}`));
      setLeft(REFRESH_SECONDS);
      timer = window.setTimeout(load, REFRESH_SECONDS * 1000);
    };
    void load();
    return () => {
      alive.current = false;
      window.clearTimeout(timer);
    };
  }, [currentUser.department, round]);

  // The seconds left, for the thin bar under the QR.
  useEffect(() => {
    const tick = window.setInterval(() => setLeft(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(tick);
  }, []);

  return (
    <ScanScreen title={tr('Το QR μου')} backLabel={tr('Αρχική')} onBack={onStations}>
      <section className="scan-pass">
        <p className="scan-pass-hint">{tr('Δείξτε το στην Αποστείρωση για να υπογράψετε την παράδοση.')}</p>
        <div className="scan-pass-code">
          {svg ? (
            <div className="scan-pass-qr" dangerouslySetInnerHTML={{__html: svg}} />
          ) : failed ? (
            <div className="scan-pass-failed">
              <span>{tr('Το QR δεν φορτώθηκε. Ελέγξτε τη σύνδεση.')}</span>
              <button type="button" className="scan-secondary" onClick={() => setRound(n => n + 1)}>
                <RefreshCw size={16} /> {tr('Δοκιμή ξανά')}
              </button>
            </div>
          ) : (
            <span className="app-spinner" aria-hidden="true" />
          )}
          {svg && (
            <span className="scan-pass-timer" aria-hidden="true">
              <i style={{width: `${(left / REFRESH_SECONDS) * 100}%`}} />
            </span>
          )}
        </div>
        <b>{trData(currentUser.name)}</b>
        {currentUser.department && <small>{trData(currentUser.department)}</small>}
        <small className="scan-pass-note">{tr('Αλλάζει κάθε 30 δευτερόλεπτα και ισχύει μία φορά.')}</small>
      </section>
    </ScanScreen>
  );
}
