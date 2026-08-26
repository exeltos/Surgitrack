import {useEffect, useRef, useState} from 'react';
import {Camera, CameraOff, RefreshCw, X} from 'lucide-react';
import AppButton from '../ui/AppButton';

type Props = {onCapture: (file: File) => void; onClose: () => void};

export default function CameraCaptureModal({onCapture, onClose}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState('');
  const stop = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };
  const start = async () => {
    stop();
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('NO_CAMERA_API');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: {ideal: facing}, width: {ideal: 1920}, height: {ideal: 1080}},
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError('Δεν ήταν δυνατή η πρόσβαση στην κάμερα. Έλεγξε την άδεια κάμερας του browser ή χρησιμοποίησε Upload.');
    }
  };
  useEffect(() => {
    start();
    return stop;
  }, [facing]);
  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      blob => {
        if (!blob) return;
        const file = new File([blob], `camera-${Date.now()}.jpg`, {type: 'image/jpeg'});
        onCapture(file);
      },
      'image/jpeg',
      0.9,
    );
  };
  return (
    <div
      className="camera-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Λήψη φωτογραφίας"
      onMouseDown={onClose}
    >
      <div className="camera-modal" onMouseDown={e => e.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow">ΚΑΜΕΡΑ</span>
            <h2>Λήψη φωτογραφίας</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Κλείσιμο">
            <X size={18} />
          </button>
        </header>
        <div className="camera-preview">
          {error ? (
            <div className="camera-error">
              <CameraOff size={34} />
              <strong>Η κάμερα δεν είναι διαθέσιμη</strong>
              <span>{error}</span>
            </div>
          ) : (
            <video ref={videoRef} playsInline muted />
          )}
        </div>
        <footer>
          <AppButton
            icon={<RefreshCw size={16} />}
            onClick={() => setFacing(v => (v === 'environment' ? 'user' : 'environment'))}
          >
            Αλλαγή κάμερας
          </AppButton>
          <AppButton variant="primary" icon={<Camera size={16} />} onClick={capture} disabled={!!error}>
            Λήψη
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
