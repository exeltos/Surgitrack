import {useState} from 'react';
import {ChevronRight, Clock3} from 'lucide-react';
import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import type {BarcodeFeedback} from '../../../components/barcode/BarcodeCapture';
import {statusLabel} from '../../../components/ui/statusLabel';
import {formatDate, parseDisplayDate} from '../../../core/displayDate';
import {tr, trData} from '../../../i18n';
import {useSurgi} from '../../../store/SurgiStore';
import ScanCamera from '../ScanCamera';
import {DemoWaiting, ScanScreen, SetContents, SetPdfButton} from '../ScanParts';
import {useScanAnswers} from '../useScanAnswers';
import {movementText} from '../../../core/movementText';

/** How many of an item's latest movements are shown. */
const RECENT = 5;

/** Lookup: scan any Set or instrument to see where it is, its state, and what happened to it last. */
export default function LookupStation({onStations}: {onStations: () => void}) {
  const {sets, tools, movements, issues, role, currentUser} = useSurgi();
  const [found, setFound] = useState<{kind: 'SET' | 'TOOL'; id: string} | null>(null);
  const [feedback, setFeedback] = useState<BarcodeFeedback | null>(null);
  useScanAnswers(feedback);
  const matches = (barcode: string, item: {barcode: string; legacyBarcodes?: string[]}) =>
    item.barcode.toUpperCase() === barcode || !!item.legacyBarcodes?.some(code => code.toUpperCase() === barcode);

  // A department user sees only their own department's equipment, as on the Set and instrument pages.
  const ownDepartment = (department: string | undefined) =>
    role !== 'DEPARTMENT' || department === currentUser.department;

  const scan = (barcode: string) => {
    const set = sets.find(item => matches(barcode, item));
    const tool = set ? undefined : tools.find(item => matches(barcode, item));
    if (!set && !tool) {
      setFeedback({type: 'ERROR', message: tr('{0} δεν βρέθηκε στο μητρώο.', barcode)});
      return;
    }
    const department = set
      ? set.department
      : tool!.department || sets.find(item => item.id === tool!.setId)?.department;
    if (!ownDepartment(department)) {
      setFound(null);
      setFeedback({
        type: 'ERROR',
        message: tr('Ο χρήστης του τμήματος βλέπει μόνο τον εξοπλισμό του δικού του τμήματος.'),
      });
      return;
    }
    setFeedback({type: 'OK', message: `${barcode} · ${(set || tool)!.name}`});
    setFound(set ? {kind: 'SET', id: set.id} : {kind: 'TOOL', id: tool!.id});
  };

  const set = found?.kind === 'SET' ? sets.find(item => item.id === found.id) : undefined;
  const tool = found?.kind === 'TOOL' ? tools.find(item => item.id === found.id) : undefined;
  const asset = set || tool;
  const parentSet = tool?.setId ? sets.find(item => item.id === tool.setId) : undefined;
  // Movements keep the barcode they were recorded with: a reissued barcode's old ones count too.
  const codes = new Set([asset?.barcode, ...(asset?.legacyBarcodes || [])].map(code => code?.toUpperCase()));
  const recent = asset
    ? movements
        .filter(m => codes.has(m.asset.split(' · ')[0].toUpperCase()))
        .sort((a, b) => (parseDisplayDate(b.at)?.getTime() ?? 0) - (parseDisplayDate(a.at)?.getTime() ?? 0))
        .slice(0, RECENT)
    : [];

  return (
    <ScanScreen
      title={tr('Αναζήτηση')}
      subtitle={tr('Σκανάρετε ένα Σετ ή εργαλείο: πού είναι, τι έγινε.')}
      backLabel={tr('Αρχική')}
      onBack={onStations}
    >
      <ScanCamera onBarcode={scan} feedback={feedback} />
      {!asset && (
        <DemoWaiting
          items={sets.filter(set => ownDepartment(set.department)).map(item => ({...item, kind: 'SET' as const}))}
          onPick={scan}
        />
      )}
      {asset && found && (
        <article className="scan-lookup">
          <header>
            <AssetTypeIcon kind={found.kind} maxUses={tool?.maxUses} size={20} framed />
            <span>
              <small className="mono">{asset.barcode}</small>
              <b>{asset.name}</b>
            </span>
          </header>
          <dl className="scan-summary">
            <div>
              <dt>{tr('Κατάσταση')}</dt>
              <dd>{statusLabel(asset.state)}</dd>
            </div>
            <div>
              <dt>{tr('Τμήμα')}</dt>
              <dd>{trData(asset.department) || tr('Χωρίς τμήμα')}</dd>
            </div>
            {parentSet && (
              <div>
                <dt>{tr('Σετ')}</dt>
                <dd>
                  <span className="mono">{parentSet.barcode}</span> · {parentSet.name}
                </dd>
              </div>
            )}
            {asset.sterileUntil && (
              <div>
                <dt>{tr('Αποστειρωμένο έως')}</dt>
                <dd>{formatDate(asset.sterileUntil)}</dd>
              </div>
            )}
          </dl>
          {set && <SetContents set={set} tools={tools.filter(item => item.setId === set.id)} issues={issues} />}
          {set && <SetPdfButton set={set} tools={tools.filter(item => item.setId === set.id)} />}
          <h2 className="scan-section">{tr('Τελευταίες κινήσεις')}</h2>
          {recent.length ? (
            <ul className="scan-moves">
              {recent.map(m => (
                <li key={m.id}>
                  <Clock3 size={15} />
                  <span>
                    <b>{movementText(m.status)}</b>
                    <small>
                      {trData(m.from)} <ChevronRight size={12} /> {trData(m.to)}
                    </small>
                    <small>
                      {m.at} · {trData(m.by)}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="scan-empty">{tr('Δεν υπάρχουν κινήσεις.')}</p>
          )}
        </article>
      )}
    </ScanScreen>
  );
}
