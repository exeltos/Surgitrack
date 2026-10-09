import {TriangleAlert, ArrowRight, X, Layers3, Wrench, PackageOpen} from 'lucide-react';
import {tr, trData} from '../../../i18n';
import type {SterilizationPageState} from '../useSterilizationPage';

export default function PrepToolManageModal({s}: {s: SterilizationPageState}) {
  const {canCompose, closePrepManage, issues, openIssueReport, openPrepToolAction, prepDraft, prepManageTool} = s;
  return (
    <>
      {prepManageTool && prepDraft && (
        <div className="nested-modal-backdrop" onMouseDown={closePrepManage}>
          <div className="tool-issue-card prep-manage-card" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" aria-label={tr('Κλείσιμο')} title={tr('Κλείσιμο')} onClick={closePrepManage}>
              <X size={17} />
            </button>
            <span className="eyebrow">{tr('ΔΙΑΧΕΙΡΙΣΗ ΕΡΓΑΛΕΙΟΥ')}</span>
            <h3>
              {prepManageTool.barcode} · {prepManageTool.name}
            </h3>
            <div className="prep-manage-summary">
              <span>
                {prepManageTool.manufacturer} · {prepManageTool.code}
                {prepManageTool.serialNumber ? ` · S/N ${prepManageTool.serialNumber}` : ''}
              </span>
            </div>
            {((prepManageTool.photos || []).length > 0 ||
              issues.some(i => i.asset.startsWith(prepManageTool.barcode) && i.photos?.length)) && (
              <div className="prep-manage-photos">
                <strong>{tr('Φωτογραφίες & τεκμηρίωση')}</strong>
                <div>
                  {[
                    ...(prepManageTool.photos || []),
                    ...issues.filter(i => i.asset.startsWith(prepManageTool.barcode)).flatMap(i => i.photos || []),
                  ].map(photo => (
                    <img key={photo.id} src={photo.dataUrl} alt={photo.name} />
                  ))}
                </div>
              </div>
            )}
            {issues.filter(i => i.status === 'OPEN' && i.asset.startsWith(prepManageTool.barcode)).length > 0 && (
              <div className="prep-manage-open-issues">
                <strong>{tr('Ανοικτές αναφορές')}</strong>
                {issues
                  .filter(i => i.status === 'OPEN' && i.asset.startsWith(prepManageTool.barcode))
                  .map(i => (
                    <div key={i.id}>
                      <TriangleAlert size={13} />
                      <span>
                        <b>{trData(i.type)}</b>
                        <small>{i.note}</small>
                      </span>
                    </div>
                  ))}
              </div>
            )}
            <div className="prep-manage-grid">
              <button
                type="button"
                onClick={() => {
                  const id = prepManageTool.id;
                  closePrepManage();
                  openIssueReport('TOOL', id, 'Αποστείρωση · σύνθεση & προετοιμασία');
                }}
              >
                <TriangleAlert size={16} />
                <span>
                  <b>{tr('Αναφορά')}</b>
                  <small>{tr('Βλάβη, φθορά ή άλλη απόκλιση')}</small>
                </span>
              </button>
              {prepDraft.kind === 'SET' && canCompose && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      closePrepManage();
                      openPrepToolAction('REPLACE');
                    }}
                  >
                    <ArrowRight size={16} />
                    <span>
                      <b>{tr('Αντικατάσταση')}</b>
                      <small>{tr('Αντικατάσταση με άλλο φυσικό εργαλείο')}</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closePrepManage();
                      openPrepToolAction('SERVICE');
                    }}
                  >
                    <Wrench size={16} />
                    <span>
                      <b>Service</b>
                      <small>{tr('Απομάκρυνση για επισκευή / έλεγχο')}</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closePrepManage();
                      openPrepToolAction('STOCK');
                    }}
                  >
                    <PackageOpen size={16} />
                    <span>
                      <b>{tr('Απόθεμα')}</b>
                      <small>{tr('Επιστροφή στο κεντρικό stock')}</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closePrepManage();
                      openPrepToolAction('SET');
                    }}
                  >
                    <Layers3 size={16} />
                    <span>
                      <b>{tr('Άλλο Σετ')}</b>
                      <small>{tr('Μεταφορά σε διαφορετικό Σετ')}</small>
                    </span>
                  </button>
                </>
              )}
            </div>
            {!canCompose && prepDraft.kind === 'SET' && (
              <p className="prep-supervisor-note">
                {tr('Αλλαγές στη σύνθεση του Σετ (αντικατάσταση, Service, Απόθεμα) κάνει ο Προϊστάμενος Αποστείρωσης.')}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
