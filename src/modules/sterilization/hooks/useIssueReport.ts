import {filesToAssetPhotos} from '../../../components/assets/photoUtils';
import type {Kind} from '../sterilizationTypes';
import type {useSterilizationState} from './useSterilizationState';
import type {useSterilizationQueues} from './useSterilizationQueues';
import type {usePreparationChecks} from './usePreparationChecks';

export function useIssueReport(
  p: ReturnType<typeof useSterilizationState> &
    ReturnType<typeof useSterilizationQueues> &
    ReturnType<typeof usePreparationChecks>,
) {
  const {
    checkEnabled,
    issueNote,
    issuePhotos,
    issueSource,
    issueTarget,
    issueType,
    prepDraft,
    prepMissingRequirements,
    receiptDraft,
    reportIssue,
    reportSetIssue,
    setIssueCameraOpen,
    setIssueNote,
    setIssuePhotos,
    setIssueSource,
    setIssueTarget,
    setIssueType,
    setReceiptBatchDeviations,
    setReceiptCheckedToolIds,
    setReceiptDeviationRecorded,
    setReceiptProblemToolIds,
    setVisibleDeviation,
  } = p;

  const addIssuePhotos = async (files: File[]) => {
    const photos = await filesToAssetPhotos(files);
    setIssuePhotos(current => [...current, ...photos]);
  };
  const openIssueReport = (kind: Kind, id: string, source: string) => {
    setIssueSource(source);
    setIssueTarget({kind, id});
    setIssueType('Βλάβη / μη λειτουργικό');
    setIssueNote('');
    setIssuePhotos([]);
  };
  const openCompositionShortageReport = () => {
    if (!prepDraft || prepDraft.kind !== 'SET') return;
    openIssueReport('SET', prepDraft.asset.id, 'Αποστείρωση · σύνθεση & προετοιμασία');
    setIssueType('Έλλειψη σύνθεσης');
    setIssueNote(prepMissingRequirements.map(req => `${req.missing}× ${req.name} (${req.code})`).join(' · '));
  };
  const closeIssueReport = () => {
    setIssueCameraOpen(false);
    setIssueTarget(null);
    setIssuePhotos([]);
  };
  const saveIssueReport = () => {
    if (!issueTarget) return;
    if (issueSource.includes('κατά την παραλαβή')) {
      setVisibleDeviation(true);
      setReceiptDeviationRecorded(true);
    }
    if (issueSource.includes('μαζική παραλαβή'))
      setReceiptBatchDeviations(current => new Set(current).add(`${issueTarget.kind}:${issueTarget.id}`));
    if (issueTarget.kind === 'SET') reportSetIssue(issueTarget.id, [], issueType, issueNote, issuePhotos, issueSource);
    else {
      reportIssue(issueTarget.id, issueType, issueNote, issueSource, issuePhotos);
      if (receiptDraft && checkEnabled && issueSource.includes('παραλαβή')) {
        setReceiptCheckedToolIds(current => new Set(current).add(issueTarget.id));
        setReceiptProblemToolIds(current => new Set(current).add(issueTarget.id));
      }
    }
    closeIssueReport();
    setIssueType('Βλάβη / μη λειτουργικό');
    setIssueNote('');
  };
  return {addIssuePhotos, closeIssueReport, openCompositionShortageReport, openIssueReport, saveIssueReport};
}
