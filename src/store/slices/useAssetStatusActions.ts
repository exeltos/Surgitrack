import type {AssetKind, AssetPhoto, Issue} from '../../types/domain';
import {formatStoreDateTime, uniqueStamp} from '../helpers';
import {tr, trData} from '../../i18n';
import type {ColorPlan} from '../../core/colorTapes';
import type {useSurgiSession} from './useSurgiSession';
import type {useSurgiRecords} from './useSurgiRecords';
import type {useSurgiHelpers} from './useSurgiHelpers';
import type {useReceiptAndCycleActions} from './useReceiptAndCycleActions';
import type {useLoadActions} from './useLoadActions';
import type {useAssetHelpers} from './useAssetHelpers';
import type {useAssetCatalogActions} from './useAssetCatalogActions';

export function useAssetStatusActions(
  p: ReturnType<typeof useSurgiSession> &
    ReturnType<typeof useSurgiRecords> &
    ReturnType<typeof useSurgiHelpers> &
    ReturnType<typeof useReceiptAndCycleActions> &
    ReturnType<typeof useLoadActions> &
    ReturnType<typeof useAssetHelpers> &
    ReturnType<typeof useAssetCatalogActions>,
) {
  const {
    addMovement,
    assetName,
    currentUser,
    notify,
    openIssue,
    setIssues,
    setSets,
    setTools,
    sets,
    tools,
    updateState,
  } = p;

  const reportSetIssue = (
    setId: string,
    targetToolIds: string[],
    type: string,
    note: string,
    photos: AssetPhoto[] = [],
    source = 'Καρτέλα Σετ',
  ) => {
    const src = sets.find(s => s.id === setId);
    if (!src) return;
    if (targetToolIds.length) {
      const selected = tools.filter(t => targetToolIds.includes(t.id));
      setIssues(x => [
        ...selected.map((t, i): Issue => ({
          id: `i${uniqueStamp()}-${i}`,
          asset: `${t.barcode} · ${t.name}`,
          type,
          status: 'OPEN',
          created: formatStoreDateTime(),
          department: src.department,
          note: `${source} · Σετ ${src.barcode}: ${note || type}`,
          photos,
        })),
        ...x,
      ]);
      notify(tr('Καταγράφηκε αναφορά για {0} εργαλεία του {1}.', selected.length, src.barcode));
      return;
    }
    setIssues(x => [
      {
        id: `i${uniqueStamp()}`,
        asset: `${src.barcode} · ${src.name}`,
        type,
        status: 'OPEN',
        created: formatStoreDateTime(),
        department: src.department,
        note: `${source}: ${note || type}`,
        photos,
      },
      ...x,
    ]);
    notify(tr('Καταγράφηκε αναφορά για το Σετ {0}.', src.barcode));
  };
  /** Declares a Set or instrument lost: an instrument leaves its Set; an issue records the loss. */
  const markLost = (kind: AssetKind, id: string, note = '') => {
    const a = assetName(kind, id);
    if (!a) return;
    const tool = kind === 'TOOL' ? tools.find(t => t.id === id) : undefined;
    const sourceSet = tool?.setId ? sets.find(s => s.id === tool.setId) : undefined;
    const from = sourceSet ? `Set ${sourceSet.barcode}` : a.department || 'Απόθεμα';
    if (tool) {
      setTools(x =>
        x.map(t =>
          t.id === id ? {...t, mode: 'STANDALONE', setId: undefined, department: undefined, state: 'LOST'} : t,
        ),
      );
      if (sourceSet) setSets(x => x.map(s => (s.id === sourceSet.id ? {...s, actual: Math.max(0, s.actual - 1)} : s)));
    } else {
      updateState('SET', id, 'LOST');
    }
    openIssue(a, 'Απώλεια', sourceSet?.department || a.department || 'Αποστείρωση', note || 'Δηλώθηκε ως χαμένο.');
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from,
      to: 'Απολεσθέντα',
      status: 'Δήλωση απώλειας',
      by: currentUser.name,
      note: note || undefined,
    });
    notify(tr('{0}: δηλώθηκε ως χαμένο.', a.barcode));
  };
  /** Brings a lost or serviced asset back: an instrument to stock, a Set to stock or its department. */
  const returnToService = (kind: AssetKind, id: string, note = '') => {
    const a = assetName(kind, id);
    if (!a) return;
    const was = a.state === 'LOST' ? 'Απολεσθέντα' : 'Χαλασμένα / Service';
    if (kind === 'TOOL') {
      const parentSetId = tools.find(t => t.id === id)?.setId;
      setTools(x =>
        x.map(t =>
          t.id === id ? {...t, mode: 'STOCK', setId: undefined, department: undefined, state: 'IN_STOCK'} : t,
        ),
      );
      if (parentSetId) setSets(x => x.map(s => (s.id === parentSetId ? {...s, actual: Math.max(0, s.actual - 1)} : s)));
    } else {
      updateState('SET', id, a.department ? 'IN_DEPARTMENT' : 'IN_STOCK');
    }
    setIssues(x =>
      x.map(i =>
        i.status === 'OPEN' && i.asset.startsWith(a.barcode) && (i.type === 'Απώλεια' || i.type === 'Βλάβη / Service')
          ? {...i, status: 'RESOLVED'}
          : i,
      ),
    );
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: was,
      to: kind === 'TOOL' || !a.department ? 'Απόθεμα' : a.department,
      status: a.state === 'LOST' ? 'Βρέθηκε · επιστροφή σε χρήση' : 'Επιστροφή από Service',
      by: currentUser.name,
      note: note || undefined,
    });
    notify(tr('{0}: επέστρεψε σε χρήση.', a.barcode));
  };
  const assignDepartment = (kind: AssetKind, id: string, department: string, note = '') => {
    const target = department.trim();
    const a = assetName(kind, id);
    if (!a || !target || a.department === target) return;
    if (a.state !== 'IN_DEPARTMENT' && a.state !== 'IN_STOCK') {
      notify(tr('{0}: το τμήμα αλλάζει μόνο όταν δεν βρίσκεται σε διαδικασία ή εκτός χρήσης.', a.barcode), true);
      return;
    }
    if (kind === 'SET') {
      // The Set's instruments go with it.
      setSets(x => x.map(s => (s.id === id ? {...s, department: target, state: 'IN_DEPARTMENT'} : s)));
      setTools(x => x.map(t => (t.setId === id ? {...t, department: target, state: 'IN_DEPARTMENT'} : t)));
    } else {
      const tool = tools.find(t => t.id === id);
      if (!tool || tool.mode === 'SET_MEMBER') return;
      setTools(x =>
        x.map(t =>
          t.id === id ? {...t, mode: 'STANDALONE', setId: undefined, department: target, state: 'IN_DEPARTMENT'} : t,
        ),
      );
    }
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: a.department || 'Απόθεμα',
      to: target,
      status: a.department ? 'Αλλαγή τμήματος' : 'Καταχώρηση σε τμήμα',
      by: currentUser.name,
      note: note || undefined,
    });
    notify(tr('{0}: καταχωρήθηκε στο τμήμα {1}.', a.barcode, trData(target)));
  };
  /** Sends a whole Set to service: it leaves circulation until it comes back. */
  const sendSetToService = (id: string, note = '') => {
    const s = sets.find(x => x.id === id);
    if (!s) return;
    updateState('SET', id, 'SERVICE');
    openIssue(s, 'Βλάβη / Service', s.department || 'Αποστείρωση', note || 'Το Σετ στάλθηκε για Service.');
    addMovement({
      asset: `${s.barcode} · ${s.name}`,
      assetKind: 'SET',
      from: s.department || 'Απόθεμα',
      to: 'Χαλασμένα / Service',
      status: 'Αποστολή Σετ σε Service',
      by: currentUser.name,
      note: note || undefined,
    });
    notify(tr('{0} μεταφέρθηκε στα Χαλασμένα / Service.', s.barcode));
  };
  /** Sets the color marker of a Set or an instrument; the history records it in words. */
  const setColorMarker = (
    kind: AssetKind,
    id: string,
    value: {mode?: 'SET' | 'OWN' | 'NONE'; tapes: string[]},
    description: string,
  ) => {
    const a = assetName(kind, id);
    if (!a) return;
    // Like every other change to the item, the marker is locked during a reprocessing cycle.
    if (!['IN_DEPARTMENT', 'IN_STOCK', 'SERVICE', 'LOST'].includes(a.state)) {
      notify(tr('{0}: ο χρωματικός μάρτυρας δεν αλλάζει όσο βρίσκεται σε διαδικασία αποστείρωσης.', a.barcode), true);
      return;
    }
    if (kind === 'SET') setSets(x => x.map(s => (s.id === id ? {...s, colorTapes: value.tapes} : s)));
    else setTools(x => x.map(t => (t.id === id ? {...t, colorMode: value.mode, colorTapes: value.tapes} : t)));
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: a.department || 'Απόθεμα',
      to: a.department || 'Απόθεμα',
      status: `Χρωματικός μάρτυρας: ${description}`,
      by: currentUser.name,
    });
    notify(tr('{0}: ο χρωματικός μάρτυρας ενημερώθηκε.', a.barcode));
  };
  /** After instruments joined a Set: the ones that take its color, and the ones that keep their tape. */
  const applyColorPlan = (plan: ColorPlan, setBarcode: string) => {
    const follow = new Set(plan.follow);
    const keep = new Map(plan.keep.map(k => [k.id, k.tapes]));
    if (!follow.size && !keep.size) return;
    setTools(x =>
      x.map(t =>
        follow.has(t.id)
          ? {...t, colorMode: 'SET', colorTapes: []}
          : keep.has(t.id)
            ? {...t, colorMode: 'OWN', colorTapes: keep.get(t.id)}
            : t,
      ),
    );
    tools
      .filter(t => follow.has(t.id) || keep.has(t.id))
      .forEach(t =>
        addMovement({
          asset: `${t.barcode} · ${t.name}`,
          assetKind: 'TOOL',
          from: `Set ${setBarcode}`,
          to: `Set ${setBarcode}`,
          status: follow.has(t.id)
            ? 'Χρωματικός μάρτυρας: όπως το Σετ · αλλαγή ταινίας'
            : 'Χρωματικός μάρτυρας: κρατά την ταινία του',
          by: currentUser.name,
        }),
      );
  };
  const retireAsset = (kind: AssetKind, id: string) => {
    const a = assetName(kind, id);
    if (!a) return;
    updateState(kind, id, 'SERVICE');
    addMovement({
      asset: `${a.barcode} · ${a.name}`,
      assetKind: kind,
      from: a.department || 'Απόθεμα',
      to: 'Απόσυρση / Service',
      status: 'Απόσυρση από ενεργή χρήση',
      by: currentUser.name,
    });
    notify(tr('{0}: αποσύρθηκε από ενεργή χρήση.', a.barcode));
  };
  return {
    applyColorPlan,
    assignDepartment,
    markLost,
    reportSetIssue,
    retireAsset,
    returnToService,
    sendSetToService,
    setColorMarker,
  };
}
