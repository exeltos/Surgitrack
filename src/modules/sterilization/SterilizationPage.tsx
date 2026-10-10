import FilterMenu from '../../components/assets/FilterMenu';
import {ScanBarcode, ShieldCheck, Barcode, X} from 'lucide-react';
import CameraCaptureModal from '../../components/assets/CameraCaptureModal';
import {tr, trData} from '../../i18n';
import {useSterilizationPage} from './useSterilizationPage';
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
    colorQuestion,
    currentUser,
    departmentFilter,
    issueCameraOpen,
    kindFilter,
    query,
    queueValues,
    quickScanFeedback,
    setDepartmentFilter,
    setIssueCameraOpen,
    setKindFilter,
    setQuery,
    setQuickScanFeedback,
    setSpecialtyFilter,
    specialtyFilter,
  } = s;
  return (
    <div className="sterilization-workspace">
      <div className="ster-work-head">
        <div>
          <span className="eyebrow">{tr('ΚΕΝΤΡΙΚΗ ΑΠΟΣΤΕΙΡΩΣΗ')}</span>
          <h1>{tr('Αποστείρωση')}</h1>
          <p>{tr('Η ροή του νοσοκομείου από το Studio, με πλήρη ιχνηλασιμότητα.')}</p>
        </div>
        <div className="ster-shift">
          <ShieldCheck size={18} />
          <div>
            <small>{tr('Συνδεδεμένος χρήστης')}</small>
            <strong>{trData(currentUser.name)}</strong>
            <span>{trData(currentUser.department)}</span>
          </div>
        </div>
      </div>
      <div className="ster-scan ster-scan-restored">
        <div className="ster-scan-icon">
          <ScanBarcode size={23} />
        </div>
        <div className="ster-scan-copy">
          <strong>{tr('Αναζήτηση & σάρωση')}</strong>
          <span>{tr('Σάρωση barcode ή πληκτρολόγηση · φιλτράρει την καρτέλα · Enter ανοίγει το barcode')}</span>
        </div>
        <div className="ster-scan-input" data-tour="ster-scan">
          <Barcode size={17} />
          <input
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
            placeholder={tr('Barcode, ονομασία, κωδικός ή τμήμα…')}
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
          <button type="button" onClick={s.scanQuery}>
            {tr('Άνοιγμα')}
          </button>
        </div>
        <div className="ster-scan-filters">
          <FilterMenu
            filters={[
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
            ]}
          />
        </div>
        {quickScanFeedback && <div className="ster-scan-feedback-inline">{quickScanFeedback}</div>}
      </div>
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
