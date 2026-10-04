/**
 * Reading a device's serial cable in the browser (Web Serial: Chrome and Edge on a computer). The
 * person picks the port; what the device prints arrives as text, chunk by chunk.
 */

type SerialPortLike = {
  open: (options: {baudRate: number}) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
};
type SerialLike = {requestPort: () => Promise<SerialPortLike>};

const serial = () => (navigator as Navigator & {serial?: SerialLike}).serial;

export const serialSupported = () => typeof navigator !== 'undefined' && !!serial();

export type SerialSession = {
  /** Settles when the port closes (unplugged, or `close()`). */
  done: Promise<void>;
  close: () => Promise<void>;
};

export async function openSerialPort(baudRate: number, onText: (chunk: string) => void): Promise<SerialSession> {
  const api = serial();
  if (!api) throw new Error('serial-unsupported');
  const port = await api.requestPort();
  await port.open({baudRate});
  const decoder = new TextDecoder();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let closing = false;
  const done = (async () => {
    while (port.readable && !closing) {
      reader = port.readable.getReader();
      try {
        for (;;) {
          const {value, done: finished} = await reader.read();
          if (finished) break;
          if (value) onText(decoder.decode(value, {stream: true}));
        }
      } catch {
        // A read error (e.g. a framing error) ends this reader; the loop opens a new one.
      } finally {
        reader.releaseLock();
      }
    }
  })();
  return {
    done,
    close: async () => {
      closing = true;
      await reader?.cancel().catch(() => undefined);
      await done.catch(() => undefined);
      await port.close().catch(() => undefined);
    },
  };
}
