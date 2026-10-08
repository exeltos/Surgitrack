import type {AssetKind, AssetPhoto, AssetState, SetAsset, Tool} from '../../types/domain';
import {formatStoreDateTime, uniqueStamp} from '../helpers';
import type {CreateSetPayload, CreateToolPayload, SurgicalCount} from '../types';
import {tr} from '../../i18n';
import {binEntryForSet, binEntryForTool} from '../../core/recycleBin';
import type {useSurgiSession} from './useSurgiSession';
import type {useSurgiRecords} from './useSurgiRecords';
import type {useSurgiHelpers} from './useSurgiHelpers';
import type {useReceiptAndCycleActions} from './useReceiptAndCycleActions';
import type {useLoadActions} from './useLoadActions';
import type {useAssetHelpers} from './useAssetHelpers';
import {formatDate} from '../../core/displayDate';

export function useAssetCatalogActions(
  p: ReturnType<typeof useSurgiSession> &
    ReturnType<typeof useSurgiRecords> &
    ReturnType<typeof useSurgiHelpers> &
    ReturnType<typeof useReceiptAndCycleActions> &
    ReturnType<typeof useLoadActions> &
    ReturnType<typeof useAssetHelpers>,
) {
  const {
    addMovement,
    assetName,
    currentUser,
    issues,
    notify,
    openIssue,
    setCounts,
    setIssues,
    setRecycleBin,
    setSets,
    setTools,
    sets,
    tools,
    setMovements,
  } = p;

  /**
   * The platform owner's clean-up of chosen history entries (already deleted on the server): they leave
   * the list, and the clean-up itself is recorded as a new entry.
   */
  const forgetMovements = (ids: readonly string[]) => {
    if (!ids.length) return;
    const gone = new Set(ids);
    setMovements(list => list.filter(m => !gone.has(m.id)));
    addMovement({
      asset: 'Ιστορικό κινήσεων',
      assetKind: 'SET',
      from: '—',
      to: '—',
      status: `Καθαρισμός ιστορικού · ${ids.length} εγγραφές`,
      by: currentUser.name,
    });
    notify(tr('Διαγράφηκαν {0} εγγραφές του ιστορικού.', ids.length));
  };
  /** A signed surgical count of a Set (or a standalone instrument); a shortage or damage opens an issue. */
  const recordCount = (p: Omit<SurgicalCount, 'id' | 'at' | 'by' | 'signed'>) => {
    const c: SurgicalCount = {
      ...p,
      id: `c${uniqueStamp()}`,
      at: formatStoreDateTime(),
      by: currentUser.name,
      signed: true,
    };
    const kind = p.assetKind || 'SET';
    const asset = kind === 'SET' ? sets.find(x => x.id === p.setId) : tools.find(x => x.id === p.setId);
    if (!asset) return undefined;
    setCounts(x => [c, ...x]);
    if (kind === 'SET')
      setSets(x => x.map(a => (a.id === p.setId ? {...a, actual: p.counted, patientCode: p.patientCode} : a)));
    const label = `${asset.barcode} · ${asset.name}`;
    const department = asset.department || '';
    if (p.counted !== p.expected || p.result !== 'OK')
      setIssues(x => [
        {
          id: `i${uniqueStamp()}`,
          asset: label,
          type: p.result === 'DAMAGE' ? 'Βλάβη' : 'Έλλειψη',
          status: 'OPEN',
          created: formatStoreDateTime(),
          department,
          note: p.note || `Αναμενόμενα ${p.expected} / καταμετρημένα ${p.counted}`,
        },
        ...x,
      ]);
    addMovement({
      asset: label,
      assetKind: kind,
      from: department,
      to: department,
      status: `Καταμέτρηση χειρουργείου υπογεγραμμένη · ${p.counted}/${p.expected}`,
      by: currentUser.name,
      patientCode: p.patientCode,
    });
    return c;
  };
  const moveTool = (
    toolId: string,
    destination: 'STOCK' | 'SET' | 'SERVICE' | 'REMOVE',
    setId?: string,
    note?: string,
  ) => {
    const t = tools.find(x => x.id === toolId);
    if (!t) return;
    const sourceSetId = t.mode === 'SET_MEMBER' ? t.setId : undefined;
    const sourceSet = sourceSetId ? sets.find(s => s.id === sourceSetId) : undefined;
    const from = sourceSet ? `Set ${sourceSet.barcode}` : t.mode === 'STOCK' ? 'Απόθεμα' : t.department || 'Τμήμα';
    if (destination === 'SET') {
      const target = sets.find(x => x.id === setId);
      if (!target || target.id === sourceSetId) return;
      // A Set in the middle of reprocessing (or out of use) takes no new instrument: it would
      // inherit a sterile state without having gone through that Set's recorded cycle.
      if (target.state !== 'IN_DEPARTMENT' && target.state !== 'IN_STOCK') {
        notify(tr('Το Σετ {0} δεν δέχεται εργαλεία όσο βρίσκεται σε διαδικασία ή εκτός χρήσης.', target.barcode));
        return;
      }
      setTools(x =>
        x.map(a =>
          a.id === toolId
            ? {...a, mode: 'SET_MEMBER', setId: target.id, department: target.department, state: target.state}
            : a,
        ),
      );
      setSets(x =>
        x.map(a =>
          a.id === sourceSetId
            ? {...a, actual: Math.max(0, a.actual - 1)}
            : a.id === target.id
              ? {...a, actual: a.actual + 1}
              : a,
        ),
      );
      addMovement({
        asset: `${t.barcode} · ${t.name}`,
        assetKind: 'TOOL',
        from,
        to: `Set ${target.barcode}`,
        status: 'Μεταφορά εργαλείου σε Set',
        by: currentUser.name,
      });
      notify(tr('{0} μετακινήθηκε στο {1}.', t.barcode, target.barcode));
      return;
    }
    if (destination === 'STOCK') {
      setTools(x =>
        x.map(a =>
          a.id === toolId ? {...a, mode: 'STOCK', setId: undefined, department: undefined, state: 'IN_STOCK'} : a,
        ),
      );
      if (sourceSetId) setSets(x => x.map(a => (a.id === sourceSetId ? {...a, actual: Math.max(0, a.actual - 1)} : a)));
      addMovement({
        asset: `${t.barcode} · ${t.name}`,
        assetKind: 'TOOL',
        from,
        to: 'Απόθεμα',
        status: 'Μεταφορά εργαλείου στο Απόθεμα',
        by: currentUser.name,
      });
      notify(tr('{0} μετακινήθηκε στο Απόθεμα.', t.barcode));
      return;
    }
    if (destination === 'REMOVE') {
      setTools(x =>
        x.map(a =>
          a.id === toolId
            ? {
                ...a,
                mode: 'STANDALONE',
                setId: undefined,
                department: sourceSet?.department || a.department,
                state: 'IN_DEPARTMENT',
              }
            : a,
        ),
      );
      if (sourceSetId) setSets(x => x.map(a => (a.id === sourceSetId ? {...a, actual: Math.max(0, a.actual - 1)} : a)));
      addMovement({
        asset: `${t.barcode} · ${t.name}`,
        assetKind: 'TOOL',
        from,
        to: sourceSet?.department || 'Εκτός Set',
        status: 'Αφαίρεση εργαλείου από Set',
        by: currentUser.name,
      });
      notify(tr('{0} αφαιρέθηκε από το Set.', t.barcode));
      return;
    }
    setTools(x =>
      x.map(a =>
        a.id === toolId ? {...a, mode: 'STANDALONE', setId: undefined, department: 'Service', state: 'SERVICE'} : a,
      ),
    );
    if (sourceSetId) setSets(x => x.map(a => (a.id === sourceSetId ? {...a, actual: Math.max(0, a.actual - 1)} : a)));
    openIssue(
      t,
      'Βλάβη / Service',
      sourceSet?.department || t.department || 'Αποστείρωση',
      note || 'Αποστείρωση · σύνθεση & προετοιμασία: μεταφέρθηκε στα χαλασμένα / Service.',
    );
    addMovement({
      asset: `${t.barcode} · ${t.name}`,
      assetKind: 'TOOL',
      from,
      to: 'Χαλασμένα / Service',
      status: 'Αφαίρεση από σύνθεση · προς Service',
      by: currentUser.name,
      note: note || undefined,
    });
    notify(tr('{0} μεταφέρθηκε στα Χαλασμένα / Service.', t.barcode));
  };
  const replaceToolInSet = (
    setId: string,
    outgoingToolId: string,
    replacementToolId: string,
    outgoingDestination: 'STOCK' | 'SERVICE' | 'SET',
    outgoingSetId?: string,
  ) => {
    const target = sets.find(s => s.id === setId);
    const outgoing = tools.find(t => t.id === outgoingToolId);
    const replacement = tools.find(t => t.id === replacementToolId);
    if (!target || !outgoing || !replacement || outgoing.id === replacement.id || outgoing.setId !== target.id) return;
    const replacementSourceSetId = replacement.mode === 'SET_MEMBER' ? replacement.setId : undefined;
    const outgoingTargetSet = outgoingDestination === 'SET' ? sets.find(s => s.id === outgoingSetId) : undefined;
    if (outgoingDestination === 'SET' && !outgoingTargetSet) return;
    if (replacementSourceSetId === target.id) return;
    setTools(list =>
      list.map(tool => {
        if (tool.id === replacement.id)
          return {...tool, mode: 'SET_MEMBER', setId: target.id, department: target.department, state: target.state};
        if (tool.id !== outgoing.id) return tool;
        if (outgoingDestination === 'STOCK')
          return {...tool, mode: 'STOCK', setId: undefined, department: undefined, state: 'IN_STOCK'};
        if (outgoingDestination === 'SERVICE')
          return {...tool, mode: 'STANDALONE', setId: undefined, department: 'Service', state: 'SERVICE'};
        return {
          ...tool,
          mode: 'SET_MEMBER',
          setId: outgoingTargetSet!.id,
          department: outgoingTargetSet!.department,
          state: outgoingTargetSet!.state,
        };
      }),
    );
    const deltas: Record<string, number> = {};
    const addDelta = (id: string | undefined, delta: number) => {
      if (id) deltas[id] = (deltas[id] || 0) + delta;
    };
    addDelta(replacementSourceSetId, -1);
    if (outgoingDestination === 'SET') addDelta(outgoingTargetSet!.id, 1);
    setSets(list => list.map(s => (deltas[s.id] ? {...s, actual: Math.max(0, s.actual + deltas[s.id])} : s)));
    if (
      outgoingDestination === 'SERVICE' &&
      !issues.some(i => i.status === 'OPEN' && i.asset.startsWith(outgoing.barcode))
    )
      setIssues(x => [
        {
          id: `i${uniqueStamp()}`,
          asset: `${outgoing.barcode} · ${outgoing.name}`,
          type: 'Βλάβη / Service',
          status: 'OPEN',
          created: formatStoreDateTime(),
          department: target.department,
          note: `Αποστείρωση · σύνθεση & προετοιμασία: αντικαταστάθηκε από ${replacement.barcode} και μεταφέρθηκε στα χαλασμένα / Service.`,
        },
        ...x,
      ]);
    addMovement({
      asset: `${outgoing.barcode} · ${outgoing.name}`,
      assetKind: 'TOOL',
      from: `Set ${target.barcode}`,
      to:
        outgoingDestination === 'STOCK'
          ? 'Απόθεμα'
          : outgoingDestination === 'SERVICE'
            ? 'Χαλασμένα / Service'
            : `Set ${outgoingTargetSet!.barcode}`,
      status: `Αντικατάσταση στη σύνθεση από ${replacement.barcode}`,
      by: currentUser.name,
    });
    const replacementFrom = replacementSourceSetId
      ? `Set ${sets.find(s => s.id === replacementSourceSetId)?.barcode || ''}`
      : replacement.mode === 'STOCK'
        ? 'Απόθεμα'
        : replacement.department || 'Μεμονωμένο σε χρήση';
    addMovement({
      asset: `${replacement.barcode} · ${replacement.name}`,
      assetKind: 'TOOL',
      from: replacementFrom,
      to: `Set ${target.barcode}`,
      status: `Αντικατάσταση εργαλείου ${outgoing.barcode}`,
      by: currentUser.name,
    });
    notify(tr('{0} αντικαταστάθηκε από {1} στο {2}.', outgoing.barcode, replacement.barcode, target.barcode));
  };
  const reportIssue = (
    toolId: string,
    type: string,
    note: string,
    source = 'Αποστείρωση',
    photos: AssetPhoto[] = [],
  ) => {
    const t = tools.find(x => x.id === toolId);
    if (!t) return;
    const sourceSet = t.setId ? sets.find(s => s.id === t.setId) : undefined;
    setIssues(x => [
      {
        id: `i${uniqueStamp()}`,
        asset: `${t.barcode} · ${t.name}`,
        type,
        status: 'OPEN',
        created: formatStoreDateTime(),
        department: sourceSet?.department || t.department || 'Απόθεμα',
        note: `${source}: ${note || type}`,
        photos,
      },
      ...x,
    ]);
    notify(tr('Καταγράφηκε αναφορά για {0}.', t.barcode));
  };
  const resolveIssues = (issueIds: string[], resolutionNote = 'Διαχειρίστηκε κατά τη σύνθεση & προετοιμασία') => {
    if (!issueIds.length) return;
    const ids = new Set(issueIds);
    setIssues(list =>
      list.map(issue =>
        ids.has(issue.id)
          ? {...issue, status: 'RESOLVED' as const, note: `${issue.note} · Επίλυση: ${resolutionNote}`}
          : issue,
      ),
    );
    notify(
      issueIds.length === 1 ? tr('Η εκκρεμότητα επιλύθηκε.') : tr('{0} εκκρεμότητες επιλύθηκαν.', issueIds.length),
    );
  };
  const addAssetPhotos = (kind: AssetKind, id: string, photos: AssetPhoto[]) => {
    if (!photos.length) return;
    if (kind === 'SET') setSets(x => x.map(a => (a.id === id ? {...a, photos: [...(a.photos || []), ...photos]} : a)));
    else setTools(x => x.map(a => (a.id === id ? {...a, photos: [...(a.photos || []), ...photos]} : a)));
    notify(photos.length === 1 ? tr('1 φωτογραφία προστέθηκε.') : tr('{0} φωτογραφίες προστέθηκαν.', photos.length));
  };
  const removeAssetPhoto = (kind: AssetKind, id: string, photoId: string) => {
    if (kind === 'SET')
      setSets(x =>
        x.map(a => (a.id === id ? {...a, photos: (a.photos || []).filter(photo => photo.id !== photoId)} : a)),
      );
    else
      setTools(x =>
        x.map(a => (a.id === id ? {...a, photos: (a.photos || []).filter(photo => photo.id !== photoId)} : a)),
      );
    notify(tr('Η φωτογραφία αφαιρέθηκε.'));
  };

  const nextBarcode = (kind: AssetKind) => {
    const prefix = kind === 'SET' ? 'S' : 'T';
    // Retired (legacy) barcodes are never handed out again.
    const assets: Array<{barcode: string; legacyBarcodes?: string[]}> = kind === 'SET' ? sets : tools;
    const barcodes = assets.flatMap(asset => [asset.barcode, ...(asset.legacyBarcodes || [])]);
    const max = barcodes.reduce((current, barcode) => {
      const numeric = Number(barcode.replace(/\D/g, ''));
      return Number.isFinite(numeric) ? Math.max(current, numeric) : current;
    }, 0);
    return `${prefix}${String(max + 1).padStart(6, '0')}`;
  };
  const createTool = (p: CreateToolPayload) => {
    const department = p.department.trim();
    const mode: 'STOCK' | 'STANDALONE' = department ? 'STANDALONE' : 'STOCK';
    let max = tools
      .flatMap(t => [t.barcode, ...(t.legacyBarcodes || [])])
      .reduce((m, barcode) => Math.max(m, Number(barcode.replace(/\D/g, '')) || 0), 0);
    const stamp = Date.now();
    const created: Tool[] = Array.from({length: p.quantity}, (_, i) => ({
      id: `tool-${stamp}-${i}`,
      barcode: `T${String(++max).padStart(6, '0')}`,
      code: p.code,
      name: p.name,
      department: mode === 'STOCK' ? undefined : department,
      specialty: p.specialty.trim(),
      manufacturer: p.manufacturer?.trim() || undefined,
      mode,
      state: mode === 'STOCK' ? 'IN_STOCK' : 'IN_DEPARTMENT',
      uses: 0,
      maxUses: p.maxUses,
      sterilizations: 0,
      notes: p.notes,
      serialNumber: p.quantity === 1 ? p.serialNumber : undefined,
    }));
    setTools(x => [...created, ...x]);
    created.forEach(t =>
      addMovement({
        asset: `${t.barcode} · ${t.name}`,
        assetKind: 'TOOL',
        from: 'Δημιουργία',
        to: mode === 'STOCK' ? 'Απόθεμα εργαλείων' : department,
        status: `Δημιουργία φυσικού εργαλείου · ${mode === 'STOCK' ? 'αυτόματα στο Απόθεμα' : 'μεμονωμένο σε χρήση'}`,
        by: currentUser.name,
      }),
    );
    notify(
      mode === 'STOCK'
        ? tr('Δημιουργήθηκαν {0} εργαλεία με μοναδικά barcodes στο Απόθεμα.', created.length)
        : tr('Δημιουργήθηκαν {0} εργαλεία με μοναδικά barcodes.', created.length),
    );
    return created.map(t => t.id);
  };
  const createSet = (p: CreateSetPayload) => {
    const barcode = nextBarcode('SET');
    const id = `set-${uniqueStamp()}`;
    const department = p.department.trim();
    const inStock = !department;
    const state: AssetState = inStock ? 'IN_STOCK' : 'IN_DEPARTMENT';
    const asset: SetAsset = {
      id,
      barcode,
      code: p.code,
      name: p.name,
      department,
      specialty: p.specialty.trim(),
      manufacturer: p.manufacturer?.trim() || undefined,
      state,
      expected: p.toolIds.length,
      actual: p.toolIds.length,
      category: 'Χειρουργικά Set',
      createdAt: formatDate(),
      uses: 0,
      maxUses: p.maxUses,
      notes: p.notes,
    };
    setSets(x => [asset, ...x]);
    setTools(x =>
      x.map(t =>
        p.toolIds.includes(t.id)
          ? {...t, mode: 'SET_MEMBER', setId: id, department: inStock ? undefined : department, state}
          : t,
      ),
    );
    addMovement({
      asset: `${barcode} · ${p.name}`,
      assetKind: 'SET',
      from: 'Δημιουργία',
      to: inStock ? 'Απόθεμα Σετ' : department,
      status: `Δημιουργία Set · ${p.toolIds.length} εργαλεία${inStock ? ' · αυτόματα ως ενιαίο Απόθεμα Σετ' : ''}`,
      by: currentUser.name,
    });
    notify(
      inStock
        ? tr('{0}: το νέο Set δημιουργήθηκε αυτόματα στο Απόθεμα Σετ.', barcode)
        : tr('{0}: το νέο Set δημιουργήθηκε.', barcode),
    );
    return id;
  };
  /**
   * A new barcode for a Set or instrument (label lost, damaged or duplicated): the next free number,
   * the old one kept as a legacy barcode so scanning an old label still finds the item.
   */
  const reissueBarcode = (kind: AssetKind, id: string, reason = 'Επανέκδοση ετικέτας') => {
    const a = assetName(kind, id);
    if (!a) return '';
    const next = nextBarcode(kind);
    const patch = {barcode: next, legacyBarcodes: [...(a.legacyBarcodes || []), a.barcode]};
    if (kind === 'SET') setSets(x => x.map(s => (s.id === id ? {...s, ...patch} : s)));
    else setTools(x => x.map(t => (t.id === id ? {...t, ...patch} : t)));
    addMovement({
      asset: `${next} · ${a.name}`,
      assetKind: kind,
      from: a.barcode,
      to: next,
      status: `Νέο barcode · ${reason}`,
      by: currentUser.name,
    });
    notify(tr('{0}: νέο barcode {1}. Το παλιό μένει στο ιστορικό.', a.barcode, next));
    return next;
  };
  const duplicateSet = (id: string, withTools = false) => {
    const src = sets.find(s => s.id === id);
    if (!src) return;
    const sourceTools = tools.filter(t => t.setId === id);
    const barcode = nextBarcode('SET');
    const newSetId = `set-${uniqueStamp()}`;
    const copy: SetAsset = {
      ...src,
      id: newSetId,
      barcode,
      code: `${src.code}-COPY`,
      name: `${src.name} · ΑΝΤΙΓΡΑΦΟ`,
      actual: withTools ? sourceTools.length : 0,
      expected: withTools ? sourceTools.length : src.expected,
      state: 'IN_DEPARTMENT',
      createdAt: formatDate(),
      photos: [],
      importBatch: undefined,
    };
    setSets(x => [copy, ...x]);
    if (withTools) {
      let max = tools.reduce((m, t) => Math.max(m, Number(t.barcode.replace(/\D/g, '')) || 0), 0);
      const stamp = Date.now();
      const copies = sourceTools.map((t, i): Tool => ({
        ...t,
        id: `tool-${stamp}-${i}`,
        barcode: `T${String(++max).padStart(6, '0')}`,
        setId: newSetId,
        mode: 'SET_MEMBER',
        state: 'IN_DEPARTMENT',
        department: copy.department,
        uses: 0,
        sterilizations: 0,
        photos: [],
        importBatch: undefined,
      }));
      setTools(x => [...copies, ...x]);
    }
    addMovement({
      asset: `${barcode} · ${copy.name}`,
      assetKind: 'SET',
      from: 'Πρότυπο',
      to: copy.department,
      status: `Δημιουργία από ${src.barcode} · ${withTools ? 'με νέα φυσικά αντίγραφα εργαλείων' : 'κενό Σετ χωρίς φυσικά εργαλεία'}`,
      by: currentUser.name,
    });
    notify(
      withTools
        ? tr('{0}: δημιουργήθηκε με αντίγραφα εργαλείων και νέα barcodes.', barcode)
        : tr('{0}: δημιουργήθηκε ως κενό Σετ.', barcode),
    );
  };
  const duplicateTool = (id: string) => {
    const src = tools.find(t => t.id === id);
    if (!src) return;
    const barcode = nextBarcode('TOOL');
    const newId = `tool-${uniqueStamp()}`;
    const copy: Tool = {
      ...src,
      id: newId,
      barcode,
      code: `${src.code}-COPY`,
      name: `${src.name} · ΑΝΤΙΓΡΑΦΟ`,
      mode: 'STOCK',
      setId: undefined,
      department: undefined,
      state: 'IN_STOCK',
      uses: 0,
      sterilizations: 0,
      serialNumber: undefined,
      photos: [],
      importBatch: undefined,
    };
    setTools(x => [copy, ...x]);
    addMovement({
      asset: `${barcode} · ${copy.name}`,
      assetKind: 'TOOL',
      from: `Αντίγραφο ${src.barcode}`,
      to: 'Απόθεμα',
      status: 'Δημιουργία νέου φυσικού εργαλείου από υπάρχουσα καρτέλα',
      by: currentUser.name,
    });
    notify(tr('{0}: δημιουργήθηκε νέο αντίγραφο εργαλείου στο Απόθεμα.', barcode));
    return newId;
  };
  const deleteSet = (id: string, deleteTools = false) => {
    const src = sets.find(s => s.id === id);
    if (!src) return;
    const members = tools.filter(t => t.setId === id);
    setRecycleBin(x => [binEntryForSet(src, members, deleteTools, currentUser.name), ...x]);
    setSets(x => x.filter(s => s.id !== id));
    if (deleteTools) setTools(x => x.filter(t => t.setId !== id));
    else
      setTools(x =>
        x.map(t =>
          t.setId === id
            ? {...t, setId: undefined, mode: 'STOCK' as const, state: 'IN_STOCK' as const, department: undefined}
            : t,
        ),
      );
    addMovement({
      asset: `${src.barcode} · ${src.name}`,
      assetKind: 'SET',
      from: src.department,
      to: deleteTools ? 'Διαγραφή' : 'Απόθεμα',
      status: deleteTools
        ? `Διαγραφή Σετ και ${members.length} εργαλείων`
        : `Διαγραφή Σετ · ${members.length} εργαλεία μεταφέρθηκαν στο Απόθεμα`,
      by: currentUser.name,
    });
    notify(
      deleteTools
        ? tr('Το Σετ και τα εργαλεία του διαγράφηκαν. Μπορείς να τα επαναφέρεις από τον Κάδο.')
        : tr('Το Σετ διαγράφηκε και τα εργαλεία μεταφέρθηκαν στο Απόθεμα. Μπορείς να το επαναφέρεις από τον Κάδο.'),
    );
  };
  const deleteTool = (id: string) => {
    const src = tools.find(t => t.id === id);
    if (!src) return;
    const parentSet = src.setId ? sets.find(s => s.id === src.setId) : undefined;
    setRecycleBin(x => [binEntryForTool(src, parentSet, currentUser.name), ...x]);
    setTools(x => x.filter(t => t.id !== id));
    if (parentSet) setSets(x => x.map(s => (s.id === parentSet.id ? {...s, actual: Math.max(0, s.actual - 1)} : s)));
    addMovement({
      asset: `${src.barcode} · ${src.name}`,
      assetKind: 'TOOL',
      from: parentSet ? `Set ${parentSet.barcode}` : src.mode === 'STOCK' ? 'Απόθεμα' : src.department || 'Μεμονωμένο',
      to: 'Διαγραφή',
      status: 'Οριστική διαγραφή φυσικού εργαλείου',
      by: currentUser.name,
    });
    notify(tr('{0}: το εργαλείο διαγράφηκε. Μπορείς να το επαναφέρεις από τον Κάδο.', src.barcode));
  };
  return {
    forgetMovements,
    addAssetPhotos,
    createSet,
    createTool,
    deleteSet,
    deleteTool,
    duplicateSet,
    duplicateTool,
    moveTool,
    nextBarcode,
    recordCount,
    reissueBarcode,
    removeAssetPhoto,
    replaceToolInSet,
    reportIssue,
    resolveIssues,
  };
}
