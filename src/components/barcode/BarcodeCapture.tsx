import {useEffect, useRef, useState} from 'react';
import {Barcode, Camera, CheckCircle2, TriangleAlert} from 'lucide-react';

export type BarcodeFeedback = {type: 'OK' | 'WARN' | 'ERROR'; message: string};

type Props = {
  title: string;
  subtitle?: string;
  placeholder?: string;
  feedback?: BarcodeFeedback | null;
  onBarcode: (barcode: string) => boolean | void;
};

export default function BarcodeCapture({
  title,
  subtitle,
  placeholder = 'Barcode · S… ή T…',
  feedback,
  onBarcode,
}: Props) {
  const [input, setInput] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastDetectedRef = useRef<{value: string; at: number}>({value: '', at: 0});
  const inputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };
  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
    setCameraError('');
    inputRef.current?.focus();
  };
  const submit = (raw = input) => {
    const value = raw.trim().toUpperCase();
    if (!value) return;
    onBarcode(value);
    setInput('');
    inputRef.current?.focus();
  };
  const startCamera = async () => {
    setCameraError('');
    setCameraOpen(true);
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Η κάμερα δεν υποστηρίζεται εδώ. Χρησιμοποίησε χειροκίνητη εισαγωγή ή scanner υπολογιστή.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: {ideal: 'environment'}},
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      const Detector = (window as any).BarcodeDetector;
      if (!Detector) {
        setCameraError(
          'Δεν υπάρχει αυτόματη αναγνώριση barcode σε αυτόν τον browser. Η χειροκίνητη εισαγωγή και ο USB/Bluetooth scanner λειτουργούν κανονικά.',
        );
        return;
      }
      const detector = new Detector({formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'data_matrix']});
      const scan = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          const value = results?.[0]?.rawValue?.trim();
          if (value) {
            const now = Date.now();
            if (value !== lastDetectedRef.current.value || now - lastDetectedRef.current.at > 1800) {
              lastDetectedRef.current = {value, at: now};
              submit(value);
            }
          }
        } catch {
          // Best-effort per-frame detection: a single failed scan frame is expected/harmless,
          // the loop below simply retries on the next animation frame.
        }
        frameRef.current = requestAnimationFrame(scan);
      };
      frameRef.current = requestAnimationFrame(scan);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : 'Δεν ήταν δυνατή η πρόσβαση στην κάμερα.');
    }
  };
  useEffect(() => () => stopCamera(), []);

  return (
    <section className="barcode-capture">
      <div className="barcode-capture-head">
        <div>
          <Barcode size={18} />
          <span>
            <strong>{title}</strong>
            {subtitle && <small>{subtitle}</small>}
          </span>
        </div>
        <button
          className={`barcode-camera-btn${cameraOpen ? ' active' : ''}`}
          type="button"
          aria-label={cameraOpen ? 'Κλείσιμο κάμερας' : 'Σάρωση barcode με κάμερα'}
          title={cameraOpen ? 'Κλείσιμο κάμερας' : 'Σάρωση με κάμερα'}
          onClick={cameraOpen ? closeCamera : startCamera}
        >
          <Camera size={16} />
          <span>{cameraOpen ? 'Κλείσιμο' : 'Κάμερα'}</span>
        </button>
      </div>
      {cameraOpen && (
        <div className="load-camera-panel">
          <div className="load-camera-view">
            <video ref={videoRef} playsInline muted />
            <div className="load-camera-target">
              <span />
            </div>
          </div>
          {cameraError && (
            <div className="load-camera-error">
              <TriangleAlert size={16} />
              <span>{cameraError}</span>
            </div>
          )}
        </div>
      )}
      <div className="load-barcode-entry">
        <Barcode size={17} />
        <input
          ref={inputRef}
          autoFocus
          value={input}
          autoComplete="off"
          inputMode="text"
          placeholder={placeholder}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" onClick={() => submit()}>
          Προσθήκη
        </button>
      </div>
      <div className="barcode-capture-help">Χειροκίνητα ή με USB/Bluetooth scanner: σάρωση στο πεδίο και Enter.</div>
      {feedback && (
        <div className={`load-scan-feedback ${feedback.type.toLowerCase()}`}>
          {feedback.type === 'OK' ? <CheckCircle2 size={16} /> : <TriangleAlert size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}
    </section>
  );
}
