// The browser's BarcodeDetector is not in the TypeScript DOM typings yet.
type BarcodeDetectorConstructor = new (options: {formats: string[]}) => {
  detect: (source: HTMLVideoElement) => Promise<{rawValue?: string}[]>;
};

/** Reads one video frame: the barcode text, or undefined when none is in view. */
export type FrameReader = (video: HTMLVideoElement) => Promise<string | undefined>;

const FORMATS = ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'data_matrix'];
/** Frames are scaled down to this width before decoding in JavaScript: fast enough on a phone. */
const DECODE_WIDTH = 720;

/**
 * A barcode reader for camera frames: the browser's own (Chrome, Android) when it has one, otherwise a
 * JavaScript decoder loaded on first use (Safari and the iPhone have no BarcodeDetector).
 */
export async function createFrameReader(): Promise<FrameReader> {
  const Detector = (window as unknown as {BarcodeDetector?: BarcodeDetectorConstructor}).BarcodeDetector;
  if (Detector) {
    const detector = new Detector({formats: FORMATS});
    return async video => (await detector.detect(video))?.[0]?.rawValue?.trim() || undefined;
  }
  const zxing = await import('@zxing/library');
  const hints = new Map<import('@zxing/library').DecodeHintType, unknown>([
    [
      zxing.DecodeHintType.POSSIBLE_FORMATS,
      [
        zxing.BarcodeFormat.CODE_128,
        zxing.BarcodeFormat.CODE_39,
        zxing.BarcodeFormat.EAN_13,
        zxing.BarcodeFormat.EAN_8,
        zxing.BarcodeFormat.QR_CODE,
        zxing.BarcodeFormat.DATA_MATRIX,
      ],
    ],
    [zxing.DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new zxing.MultiFormatReader();
  reader.setHints(hints);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', {willReadFrequently: true});
  return async video => {
    if (!context || !video.videoWidth) return undefined;
    const scale = Math.min(1, DECODE_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const source = new zxing.HTMLCanvasElementLuminanceSource(canvas);
      const result = reader.decodeWithState(new zxing.BinaryBitmap(new zxing.HybridBinarizer(source)));
      return result.getText().trim() || undefined;
    } catch {
      // No barcode in this frame: the next one is read a moment later.
      return undefined;
    }
  };
}
