import type {DeviceConnection, DeviceKind} from '../../core/deviceData';

export const KINDS: DeviceKind[] = ['STERILIZER', 'WASHER', 'SEALER', 'OTHER'];
export const CONNECTIONS: DeviceConnection[] = ['API', 'FILE', 'SERIAL'];
export const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];
export const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : String((e as {message?: string} | null)?.message || e);

export type Lang = (el: string, en: string) => string;
