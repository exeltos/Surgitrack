import {useEffect, useRef, useState} from 'react';
import {CameraOff, CheckCircle2, Flashlight, Keyboard, ScanBarcode, TriangleAlert} from 'lucide-react';
import type {BarcodeFeedback} from '../../components/barcode/BarcodeCapture';
import {createFrameReader} from '../../core/barcodeReader';
import {tr} from '../../i18n';

/**
 * The phone app's scanner: «Σάρωση» opens the camera for one barcode (it closes once it has read it), plus
 * typing and a Bluetooth/USB scanner (it types the barcode and Enter anywhere on the screen). `feedback` is
 * the answer to the last scan.
 */
export default function ScanCamera({
  onBarcode,
  feedback,
}: {
  onBarcode: (barcode: string) => void;
  feedback?: BarcodeFeedback | null;
}) {
  const [on, setOn] = useState(false);
  const [error, setError] = useState('');
  const [torch, setTorch] = useState<boolean | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const submitRef = useRef(onBarcode);
  submitRef.current = onBarcode;

  const submit = (raw: string) => {
    const value = raw.trim().toUpperCase();
    if (value) submitRef.current(value);
  };

  useEffect(() => {
    if (!on) return;
    let stopped = false;
    const stop = () => {
      stopped = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setTorch(null);
    };
    const start = async () => {
      setError('');
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(tr('Η κάμερα δεν είναι διαθέσιμη εδώ. Πληκτρολογήστε το barcode ή χρησιμοποιήστε scanner.'));
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}, height: {ideal: 720}},
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const capabilities = (track?.getCapabilities?.() || {}) as {torch?: boolean};
        setTorch(capabilities.torch ? false : null);
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const read = await createFrameReader();
        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const value = await read(videoRef.current);
            // One barcode per press: the camera closes as soon as it has read one.
            if (value && !stopped) {
              stopped = true;
              submit(value);
              setOn(false);
              return;
            }
          } catch {
            // One unreadable frame is normal; the next one is read a moment later.
          }
          if (!stopped) timerRef.current = window.setTimeout(() => void scan(), 120);
        };
        void scan();
      } catch (e) {
        setError(
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? tr('Δεν δόθηκε άδεια για την κάμερα. Επιτρέψτε την από τις ρυθμίσεις του browser.')
            : tr('Δεν ήταν δυνατή η πρόσβαση στην κάμερα.'),
        );
      }
    };
    void start();
    return stop;
  }, [on]);

  // A Bluetooth/USB scanner types fast and ends with Enter: caught anywhere outside a text field.
  useEffect(() => {
    let buffer = '';
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const now = Date.now();
      if (now - last > 250) buffer = '';
      last = now;
      if (e.key === 'Enter') {
        if (buffer.length >= 3) submit(buffer);
        buffer = '';
      } else if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || torch === null) return;
    try {
      await track.applyConstraints({advanced: [{torch: !torch} as MediaTrackConstraintSet]});
      setTorch(!torch);
    } catch {
      setTorch(null);
    }
  };

  return (
    <section className="scan-camera">
      {on ? (
        <div className="scan-camera-view">
          <video ref={videoRef} playsInline muted />
          <div className="scan-camera-target" aria-hidden="true">
            <span />
          </div>
          {error && (
            <div className="scan-camera-error" role="alert">
              <TriangleAlert size={16} /> {error}
            </div>
          )}
          {feedback && (
            <div className={`scan-camera-feedback ${feedback.type.toLowerCase()}`} role="status">
              {feedback.type === 'OK' ? <CheckCircle2 size={17} /> : <TriangleAlert size={17} />}
              <span>{feedback.message}</span>
            </div>
          )}
        </div>
      ) : (
        feedback && (
          <div className={`scan-camera-feedback inline ${feedback.type.toLowerCase()}`} role="status">
            {feedback.type === 'OK' ? <CheckCircle2 size={17} /> : <TriangleAlert size={17} />}
            <span>{feedback.message}</span>
          </div>
        )
      )}
      {on ? (
        <div className="scan-camera-tools">
          <button type="button" onClick={() => setOn(false)}>
            <CameraOff size={17} /> {tr('Κλείσιμο κάμερας')}
          </button>
          {torch !== null && (
            <button type="button" onClick={() => void toggleTorch()} aria-pressed={torch}>
              <Flashlight size={17} /> {tr('Φακός')}
            </button>
          )}
        </div>
      ) : (
        <div className="scan-camera-start">
          <button type="button" className="scan-primary" onClick={() => setOn(true)}>
            <ScanBarcode size={22} /> {tr('Σάρωση')}
          </button>
          <button
            type="button"
            className="scan-secondary"
            onClick={() => setTyping(v => !v)}
            aria-pressed={typing}
            aria-label={tr('Πληκτρολόγηση')}
            title={tr('Πληκτρολόγηση')}
          >
            <Keyboard size={20} />
          </button>
        </div>
      )}
      {typing && (
        <form
          className="scan-camera-type"
          onSubmit={e => {
            e.preventDefault();
            submit(typed);
            setTyped('');
          }}
        >
          <input
            autoFocus
            value={typed}
            onChange={e => setTyped(e.target.value.toUpperCase())}
            placeholder={tr('Barcode · π.χ. S000324')}
            aria-label={tr('Barcode')}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button type="submit" className="primary" disabled={!typed.trim()}>
            {tr('Προσθήκη')}
          </button>
        </form>
      )}
    </section>
  );
}
