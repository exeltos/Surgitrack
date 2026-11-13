import {useState} from 'react';
import {CheckCircle2, ChevronRight, Clock3, TriangleAlert} from 'lucide-react';
import {expiryStatus, formatExpiry} from '../../../core/sterileExpiry';
import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import type {BarcodeFeedback} from '../../../components/barcode/BarcodeCapture';
import {statusLabel} from '../../../components/ui/statusLabel';
import {formatDate, parseDisplayDate} from '../../../core/displayDate';
import {tr, trData} from '../../../i18n';
import {useSurgi} from '../../../store/SurgiStore';
import ScanCamera from '../ScanCamera';
import {DemoWaiting, ScanScreen, SetContents, SetPdfButton} from '../ScanParts';
import {setMissing} from '../stationCounts';
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

  // The answer first, for whoever scans a Set on the shelf: can it be used now, and if not, why.
  const missing = set
    ? setMissing(
        set,
        tools.filter(item => item.setId === set.id),
      )
    : 0;
  const expired = !!asset?.sterileUntil && expiryStatus(asset.sterileUntil, asset.shelfLifeMonths).state === 'EXPIRED';
  const usableStates = ['IN_DEPARTMENT', 'READY_FOR_PICKUP'];
  const verdict = !asset
    ? null
    : !usableStates.includes((parentSet || asset).state)
      ? {ok: false, text: tr('Δεν είναι διαθέσιμο: {0}', statusLabel((parentSet || asset).state))}
      : expired
        ? {ok: false, text: tr('Η αποστείρωση έληξε στις {0}', formatExpiry(asset.sterileUntil!))}
        : missing > 0
          ? {ok: false, text: missing === 1 ? tr('Λείπει 1 εργαλείο') : tr('Λείπουν {0} εργαλεία', missing)}
          : {ok: true, text: tr('Έτοιμο για χρήση')};

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
            <AssetTypeIcon kind={found.kind} maxUses={tool?.maxUses} wearCheck={tool?.wearCheck} size={20} framed />
            <span>
              <small className="mono">{asset.barcode}</small>
              <b>{asset.name}</b>
            </span>
          </header>
          {verdict && (
            <p className={`scan-answer ${verdict.ok ? 'ok' : 'bad'}`} role="status">
              {verdict.ok ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}
              {verdict.text}
            </p>
          )}
          {/* Where it is and until when, in one quiet line. */}
          <p className="scan-facts">
            {[
              statusLabel(asset.state),
              trData(asset.department) || tr('Χωρίς τμήμα'),
              parentSet ? `${tr('Σετ')} ${parentSet.barcode}` : '',
              asset.sterileUntil ? tr('έως {0}', formatDate(asset.sterileUntil)) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {set && <SetContents set={set} tools={tools.filter(item => item.setId === set.id)} issues={issues} quiet />}
          {set && <SetPdfButton set={set} tools={tools.filter(item => item.setId === set.id)} />}
          {/* The history only when asked for: one tap opens it. */}
          <details className="scan-more">
            <summary>{tr('Τελευταίες κινήσεις')}</summary>
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
          </details>
        </article>
      )}
    </ScanScreen>
  );
}
