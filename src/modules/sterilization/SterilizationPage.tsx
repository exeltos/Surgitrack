import FilterMenu from '../../components/assets/FilterMenu';
import {ScanBarcode, X} from 'lucide-react';
import CameraCaptureModal from '../../components/assets/CameraCaptureModal';
import {tr} from '../../i18n';
import {limitFilterOptions, usageFilterOptions} from '../../core/usageFilter';
import {useSterilizationPage} from './useSterilizationPage';
import {LONG_WAIT_HOURS} from './hooks/useSterilizationQueues';
import QueueTabs from './parts/QueueTabs';
import WorkPanel from './parts/WorkPanel';
import LoadModal from './parts/LoadModal';
import ReleaseLoadModal from './parts/ReleaseLoadModal';
import CheckpointModal from './parts/CheckpointModal';
import ReceiptModal from './parts/ReceiptModal';
import IssueReportModal from './parts/IssueReportModal';
import PreparationModal from './parts/PreparationModal';
import PrepMissingModal from './parts/PrepMissingModal';
import PrepSetIssueModal from './parts/PrepSetIssueModal';
import PrepToolManageModal from './parts/PrepToolManageModal';
import PrepToolActionModal from './parts/PrepToolActionModal';
import ReleaseModal from './parts/ReleaseModal';
import ReceiptBatchModal from './parts/ReceiptBatchModal';
import DeliveryBatchModal from './parts/DeliveryBatchModal';
import DeliveryModal from './parts/DeliveryModal';
import ReceiptViewModal from './parts/ReceiptViewModal';

export default function SterilizationPage() {
  const s = useSterilizationPage();
  const {
    addIssuePhotos,
    attentionFilter,
    setAttentionFilter,
    colorQuestion,
    departmentFilter,
    issueCameraOpen,
    kindFilter,
    query,
    queueValues,
    quickScanFeedback,
    setDepartmentFilter,
    setIssueCameraOpen,
    setKindFilter,
    setUsageFilter,
    setQuery,
    setQuickScanFeedback,
    setSpecialtyFilter,
    specialtyFilter,
    usageFilter,
  } = s;
  return (
    <div className="sterilization-workspace">
      <div className="ster-work-head">
        <div>
          <span className="eyebrow">{tr('Κεντρική Αποστείρωση')}</span>
          <h1>{tr('Αποστείρωση')}</h1>
          <p>{tr('Η πορεία των εργαλείων από την παραλαβή έως την παράδοση στο τμήμα.')}</p>
        </div>
      </div>
      {/* The scan or search on the bar every list has: Enter or «Άνοιγμα» opens the barcode, typing filters the tab. */}
      <div className="asset-filter-bar ster-scan-bar">
        <div className="asset-filter-search" data-tour="ster-scan">
          <ScanBarcode size={17} />
          <input
            type="search"
            autoComplete="off"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setQuickScanFeedback('');
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                s.scanQuery();
              }
              if (e.key === 'Escape') setQuery('');
            }}
            placeholder={tr('Σάρωση ή αναζήτηση: barcode, ονομασία, κωδικός ή τμήμα…')}
            aria-label={tr('Αναζήτηση & σάρωση')}
          />
          {query && (
            <button
              type="button"
              className="ster-scan-clear"
              aria-label={tr('Καθαρισμός')}
              onClick={() => setQuery('')}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button type="button" className="asset-filter-toggle" onClick={s.scanQuery}>
          {tr('Άνοιγμα')}
        </button>
        <FilterMenu
          filters={[
            {
              key: 'attention',
              value: attentionFilter,
              placeholder: tr('Όλα'),
              options: [
                {value: 'NOTE', label: tr('Με σημείωση τμήματος')},
                {value: 'SHORT', label: tr('Σετ με έλλειψη')},
                {value: 'WAITING', label: tr('Περιμένουν πάνω από {0} ώρες', LONG_WAIT_HOURS)},
              ],
              onChange: setAttentionFilter,
            },
            {
              key: 'department',
              value: departmentFilter,
              placeholder: tr('Όλα τα τμήματα'),
              options: queueValues('department').map(value => ({value, label: value})),
              onChange: setDepartmentFilter,
            },
            {
              key: 'specialty',
              value: specialtyFilter,
              placeholder: tr('Όλες οι ειδικότητες'),
              options: queueValues('specialty').map(value => ({value, label: value})),
              onChange: setSpecialtyFilter,
            },
            {
              key: 'kind',
              value: kindFilter,
              placeholder: tr('Σετ & εργαλεία'),
              options: [
                {value: 'SET', label: tr('Μόνο Σετ')},
                {value: 'TOOL', label: tr('Μόνο εργαλεία')},
              ],
              onChange: setKindFilter,
            },
            {
              key: 'usage',
              value: usageFilter,
              // Instruments with a limit of uses until they wear out, and how far along they are.
              placeholder: tr('Με ή χωρίς όριο'),
              options: [...limitFilterOptions(), ...usageFilterOptions()],
              onChange: setUsageFilter,
            },
          ]}
        />
      </div>
      {quickScanFeedback && <div className="ster-scan-feedback-inline">{quickScanFeedback}</div>}
      <QueueTabs s={s} />
      <WorkPanel s={s} />
      <LoadModal s={s} />
      <ReleaseLoadModal s={s} />
      <CheckpointModal s={s} />
      <ReceiptModal s={s} />
      <IssueReportModal s={s} />
      {issueCameraOpen && (
        <CameraCaptureModal
          onCapture={async file => {
            await addIssuePhotos([file]);
            setIssueCameraOpen(false);
          }}
          onClose={() => setIssueCameraOpen(false)}
        />
      )}
      <PreparationModal s={s} />
      <PrepMissingModal s={s} />
      <PrepSetIssueModal s={s} />
      <PrepToolManageModal s={s} />
      <PrepToolActionModal s={s} />
      <ReleaseModal s={s} />
      <ReceiptBatchModal s={s} />
      <DeliveryBatchModal s={s} />
      <DeliveryModal s={s} />
      <ReceiptViewModal s={s} />
      {colorQuestion.dialog}
    </div>
  );
}
