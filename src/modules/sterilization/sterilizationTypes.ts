import type {AssetKind, SetAsset, Tool} from '../../types/domain';
import {tr} from '../../i18n';
import type {HandoverSigner} from '../../data/cloud/handover';
import type {DeviceReading} from '../../core/deviceData';

export type Queue =
  'INCOMING' | 'WASHING' | 'PREP' | 'PACKAGING' | 'PROCESS' | 'IN_STERILIZER' | 'RELEASE' | 'STORAGE' | 'READY';

export type Kind = AssetKind;

export type SterilizationRow = (SetAsset & {kind: 'SET'}) | (Tool & {kind: 'TOOL'});

export type AssetDraft = {kind: 'SET'; asset: SetAsset} | {kind: 'TOOL'; asset: Tool};

export type Identity = HandoverSigner;

export const deviceNote = (reading: DeviceReading) =>
  [
    tr('Δεδομένα συσκευής'),
    reading.maxTemperature !== undefined && `${reading.maxTemperature}°C`,
    reading.maxPressure !== undefined && `${reading.maxPressure} bar`,
    reading.durationMinutes !== undefined && `${reading.durationMinutes}′`,
  ]
    .filter(Boolean)
    .join(' · ');
