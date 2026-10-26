import type {
  AssetKind,
  AssetState,
  DeliveryRecord,
  Movement,
  PreparationRecord,
  ReceiptRecord,
  SetAsset,
  SterilizationReleaseRecord,
  Tool,
  WorkflowCheckpointRecord,
} from '../types/domain';
import {nextStateAfter, workflowStageState, type WorkflowStageConfig, type WorkflowStageId} from './workflow';
import type {UndoAction, UndoSnapshot} from './movementUndo';

/**
 * Undoing a movement recorded before movements kept what they changed (an "older" movement, with no undo).
 *
 * What it changed is worked out from what kind of movement it is and where the Set or instrument is now:
 * a dispatch puts it back in the department, with the sterile dates of its latest release; a receipt back to
 * awaiting receipt; a delivery back to ready for pickup; a stage back to that stage. Uses, and instruments
 * taken out of use at their limit, are not known and stay as they are (the admin corrects them separately).
 * Only the hospital admin and the Sterilization supervisor undo an older movement.
 */
export type LegacyContext = {
  sets: readonly SetAsset[];
  tools: readonly Tool[];
  stages: readonly WorkflowStageConfig[];
  receipts: readonly ReceiptRecord[];
  deliveries: readonly DeliveryRecord[];
  preparations: readonly PreparationRecord[];
  checkpoints: readonly WorkflowCheckpointRecord[];
  releases: readonly SterilizationReleaseRecord[];
};

type Guess = {action: UndoAction; before: AssetState; after: AssetState; stage?: string; recordId?: string};

const startsWith = (status: string, ...prefixes: string[]) =>
  prefixes.some(prefix => status.trim().toLowerCase().startsWith(prefix.toLowerCase()));

/**
 * What the older movement did, read from its wording (today's, and the older and Demo wordings: «Παραλαβή στην
 * Αποστείρωση», «Παράδοση στο τμήμα»…); undefined when it is not one that is undone.
 */
function guess(m: Movement, kind: AssetKind, id: string, department: string | undefined, c: LegacyContext) {
  const next = (stageId: WorkflowStageId) => nextStateAfter(c.stages, stageId) as AssetState;
  const sameRecord = <T extends {id: string; assetId: string; assetKind: AssetKind}>(
    list: readonly T[],
    at: (r: T) => string,
  ) => list.find(r => r.assetId === id && r.assetKind === kind && at(r) === m.at)?.id;
  const label = (stageId: WorkflowStageId) => c.stages.find(s => s.id === stageId)?.labelEl || stageId;
  if (
    startsWith(m.status, 'Ηλεκτρονική αποστολή', 'Αποστολή προς αποστείρωση', 'Ηλεκτρονικά προωθημένο') &&
    m.from === department
  )
    return {action: 'DISPATCH', before: 'IN_DEPARTMENT', after: 'PENDING_STERILIZATION'} satisfies Guess;
  if (startsWith(m.status, 'Φυσική παραλαβή', 'Παραλαβή στην Αποστείρωση', 'Παραλαβή και έλεγχος', 'Έναρξη καθαρισμού'))
    return {
      action: 'RECEIPT',
      before: 'PENDING_STERILIZATION',
      after: next('RECEIPT'),
      recordId: sameRecord(c.receipts, r => r.at),
    } satisfies Guess;
  if (startsWith(m.status, 'Παράδοση / παραλαβή ολοκληρώθηκε', 'Παράδοση στο τμήμα'))
    return {
      action: 'DELIVERY',
      before: 'READY_FOR_PICKUP',
      after: 'IN_DEPARTMENT',
      recordId: sameRecord(c.deliveries, r => r.at),
    } satisfies Guess;
  if (startsWith(m.status, 'Φορτίο πλυντηρίου', 'Ολοκλήρωση καθαρισμού'))
    return {
      action: 'STAGE',
      before: 'IN_WASHING',
      after: next('WASHING'),
      stage: label('WASHING'),
      recordId: sameRecord(c.checkpoints, r => r.completedAt),
    } satisfies Guess;
  if (startsWith(m.status, 'Σύνθεση / προετοιμασία ολοκληρώθηκε', 'Σύνθεση πλήρης'))
    return {
      action: 'STAGE',
      before: 'IN_PREPARATION',
      after: next('PREPARATION'),
      stage: label('PREPARATION'),
      recordId: sameRecord(c.preparations, r => r.at),
    } satisfies Guess;
  if (startsWith(m.status, 'Ολοκλήρωση ελέγχου · ')) {
    const name = m.status.split(' · ').slice(1).join(' · ').trim();
    const stage = c.stages.find(s => s.labelEl === name);
    if (!stage) return undefined;
    return {
      action: 'STAGE',
      before: workflowStageState[stage.id] as AssetState,
      after: next(stage.id),
      stage: stage.labelEl,
      recordId: sameRecord(c.checkpoints, r => r.completedAt),
    } satisfies Guess;
  }
  return undefined;
}

/** The snapshot an older movement would have kept, as far as it can be worked out; undefined otherwise. */
export function legacySnapshot(m: Movement, kind: AssetKind, id: string, c: LegacyContext): UndoSnapshot | undefined {
  const asset = kind === 'SET' ? c.sets.find(s => s.id === id) : c.tools.find(t => t.id === id);
  if (!asset) return undefined;
  const g = guess(m, kind, id, asset.department, c);
  if (!g || asset.state !== g.after) return undefined;
  // A dispatch took the sterile dates off: those of its latest release come back.
  const release =
    g.action === 'DISPATCH'
      ? c.releases.find(r => r.assetId === id && r.assetKind === kind && r.decision === 'RELEASED' && r.sterileUntil)
      : undefined;
  const sterile = release
    ? {
        sterileUntil: release.sterileUntil,
        sterilizedOn: release.sterilizedOn ?? null,
        sterilizedTime: release.sterilizedTime ?? null,
      }
    : {};
  const members = kind === 'SET' ? c.tools.filter(t => t.setId === id) : [];
  return {
    action: g.action,
    kind,
    id,
    after: g.after,
    usesCounted: false,
    legacy: true,
    ...(g.recordId ? {recordId: g.recordId} : {}),
    ...(g.stage ? {stage: g.stage} : {}),
    assets: [
      {kind, id, before: {state: g.before, ...sterile}},
      ...members.map(t => ({kind: 'TOOL' as const, id: t.id, before: {state: g.before, mode: t.mode}})),
    ],
  };
}
