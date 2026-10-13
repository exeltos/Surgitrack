import type {BarcodeFeedback} from '../../components/barcode/BarcodeCapture';

let audio: AudioContext | null = null;

/** A short tone: high for a scan taken, low and longer for one refused. */
const tone = (frequency: number, seconds: number) => {
  try {
    const Context =
      window.AudioContext || (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!Context) return;
    audio ??= new Context();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.12, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + seconds);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + seconds);
  } catch {
    // Sound is a courtesy: a phone that blocks it still shows the colour and the message.
  }
};

/** What the person holding the phone hears and feels after a scan (the screen shows the message). */
export function signalScan(type: BarcodeFeedback['type']) {
  if (type === 'OK') tone(1320, 0.09);
  else tone(type === 'WARN' ? 660 : 330, 0.28);
  try {
    navigator.vibrate?.(type === 'OK' ? 40 : [90, 60, 90]);
  } catch {
    // Not every phone vibrates on request (the iPhone does not).
  }
}
