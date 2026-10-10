import {useMemo} from 'react';
import type {AssetKind, AssetState} from '../../types/domain';
import {getLifecycleAlerts, normalizeUsageLimit} from '../helpers';
import type {SetUpdatePatch, ToolUpdatePatch} from '../types';
import {renameComposition, staleCompositionLines} from '../../core/nameCheck';
import {tr} from '../../i18n';
import type {useSurgiSession} from './useSurgiSession';
import type {useSurgiRecords} from './useSurgiRecords';
import type {useSurgiHelpers} from './useSurgiHelpers';
import type {useReceiptAndCycleActions} from './useReceiptAndCycleActions';
import type {useLoadActions} from './useLoadActions';
import type {useAssetHelpers} from './useAssetHelpers';
import type {useAssetCatalogActions} from './useAssetCatalogActions';
import type {useAssetStatusActions} from './useAssetStatusActions';

export function useAssetEditActions(
  p: ReturnType<typeof useSurgiSession> &
    ReturnType<typeof useSurgiRecords> &
    ReturnType<typeof useSurgiHelpers> &
    ReturnType<typeof useReceiptAndCycleActions> &
    ReturnType<typeof useLoadActions> &
    ReturnType<typeof useAssetHelpers> &
    ReturnType<typeof useAssetCatalogActions> &
    ReturnType<typeof useAssetStatusActions>,
) {
  const {addMovement, can, currentUser, notify, setSets, setTools, sets, systemSettings, tools, undoable} = p;

  /** Lives (usage limits) change only by the admin or the Sterilization supervisor. */
  const withoutUsageUnlessAllowed = <T extends {maxUses?: number}>(patch: T): T => {
    if (!('maxUses' in patch) || can('asset.usage.configure')) return patch;
    const rest = {...patch};
    delete rest.maxUses;
    return rest;
  };
  const updateSet = (id: string, rawPatch: SetUpdatePatch) => {
    const patch = withoutUsageUnlessAllowed(rawPatch);
    const before = sets.find(s => s.id === id);
    if (!before) return;
    const barcodeChanged = patch.barcode && patch.barcode !== before.barcode;
    const normalizedBarcode = patch.barcode?.trim().toUpperCase();
    if (normalizedBarcode && sets.some(s => s.id !== id && s.barcode === normalizedBarcode)) {
      notify(tr('Το barcode {0} χρησιμοποιείται ήδη.', normalizedBarcode), true);
      return;
    }
    const requestedDepartment = (patch.department ?? before.department).trim();
    const departmentWasEdited = patch.department !== undefined;
    const nextState: AssetState = departmentWasEdited
      ? requestedDepartment
        ? 'IN_DEPARTMENT'
        : 'IN_STOCK'
      : (patch.state ?? before.state);
    const inStock = nextState === 'IN_STOCK';
    const department = inStock ? '' : requestedDepartment;
    if (!inStock && !department) {
      notify(tr('Ορίστε Τμήμα για να βγει το Σετ από το Απόθεμα.'), true);
      return;
    }
    const nextPatch = {
      ...patch,
      state: nextState,
      department,
      ...(normalizedBarcode ? {barcode: normalizedBarcode} : {}),
      ...(barcodeChanged ? {legacyBarcodes: [...(before.legacyBarcodes || []), before.barcode]} : {}),
    };
    setSets(list => list.map(s => (s.id === id ? {...s, ...nextPatch} : s)));
    if (inStock || department !== before.department || nextState !== before.state)
      setTools(list =>
        list.map(t =>
          t.setId === id
            ? {...t, mode: 'SET_MEMBER', department: inStock ? undefined : department, state: nextState}
            : t,
        ),
      );
    const changedBarcode = barcodeChanged ? ` · Barcode ${before.barcode} → ${normalizedBarcode}` : '';
    const stockChange =
      before.state !== nextState
        ? inStock
          ? ' · Μεταφορά ολόκληρου Σετ στο Απόθεμα'
          : ' · Έξοδος Σετ από Απόθεμα'
        : '';
    addMovement({
      asset: `${before.barcode} · ${patch.name || before.name}`,
      assetKind: 'SET',
      from: 'Στοιχεία Σετ',
      to: inStock ? 'Απόθεμα Σετ' : 'Στοιχεία Σετ',
      status: `Επεξεργασία στοιχείων Σετ${changedBarcode}${stockChange}`,
      by: currentUser.name,
    });
    notify(tr('{0}: οι αλλαγές αποθηκεύτηκαν.', normalizedBarcode || before.barcode));
  };
  const updateTool = (id: string, rawPatch: ToolUpdatePatch) => {
    const patch = withoutUsageUnlessAllowed(rawPatch);
    const before = tools.find(t => t.id === id);
    if (!before) return;
    const barcodeChanged = patch.barcode && patch.barcode !== before.barcode;
    const normalizedBarcode = patch.barcode?.trim().toUpperCase();
    if (normalizedBarcode && tools.some(t => t.id !== id && t.barcode === normalizedBarcode)) {
      notify(tr('Το barcode {0} χρησιμοποιείται ήδη.', normalizedBarcode), true);
      return;
    }
    const parentSet = before.setId ? sets.find(s => s.id === before.setId) : undefined;
    const departmentWasEdited = patch.department !== undefined;
    const requestedDepartment = (patch.department ?? before.department ?? '').trim();
    let mode = before.mode;
    let setId = before.setId;
    let state = patch.state ?? before.state;
    let invariantDepartment = before.department;
    if (before.mode === 'SET_MEMBER') {
      invariantDepartment = parentSet?.state === 'IN_STOCK' ? undefined : parentSet?.department;
      state = parentSet?.state ?? state;
    } else if (departmentWasEdited) {
      if (requestedDepartment) {
        mode = 'STANDALONE';
        setId = undefined;
        state = 'IN_DEPARTMENT';
        invariantDepartment = requestedDepartment;
      } else {
        mode = 'STOCK';
        setId = undefined;
        state = 'IN_STOCK';
        invariantDepartment = undefined;
      }
    } else if (before.mode === 'STOCK') {
      invariantDepartment = undefined;
      state = 'IN_STOCK';
    }
    const nextPatch = {
      ...patch,
      mode,
      setId,
      state,
      department: invariantDepartment,
      ...(normalizedBarcode ? {barcode: normalizedBarcode} : {}),
      ...(barcodeChanged ? {legacyBarcodes: [...(before.legacyBarcodes || []), before.barcode]} : {}),
    };
    setTools(list => list.map(t => (t.id === id ? {...t, ...nextPatch} : t)));
    const changedBarcode = barcodeChanged ? ` · Barcode ${before.barcode} → ${normalizedBarcode}` : '';
    const locationChange =
      before.mode !== mode
        ? mode === 'STOCK'
          ? ' · Μεταφορά στο Απόθεμα'
          : ' · Μετατροπή σε μεμονωμένο σε χρήση'
        : '';
    addMovement({
      asset: `${before.barcode} · ${patch.name || before.name}`,
      assetKind: 'TOOL',
      from: 'Στοιχεία Εργαλείου',
      to: mode === 'STOCK' ? 'Απόθεμα εργαλείων' : 'Στοιχεία Εργαλείου',
      status: `Επεξεργασία στοιχείων εργαλείου${changedBarcode}${locationChange}`,
      by: currentUser.name,
    });
    notify(tr('{0}: οι αλλαγές αποθηκεύτηκαν.', normalizedBarcode || before.barcode));
  };
  const renameTools = (changes: Array<{id: string; name: string}>, label: string) => {
    const byId = new Map(changes.map(c => [c.id, c.name.trim()]));
    const changing = tools.filter(t => byId.has(t.id) && byId.get(t.id) && byId.get(t.id) !== t.name);
    if (!changing.length) return;
    // A Set's composition lists the same instruments by code and name: those names follow.
    const renamed = new Map(changing.map(t => [`${(t.code || '').trim().toUpperCase()}|${t.name}`, byId.get(t.id)!]));
    const follow = (code: string, name: string) => renamed.get(`${code.trim().toUpperCase()}|${name}`);
    undoable(label, () => {
      setTools(list => list.map(t => (byId.has(t.id) && byId.get(t.id) ? {...t, name: byId.get(t.id)!} : t)));
      setSets(list =>
        list.map(set => {
          const compositionTemplate = renameComposition(set.compositionTemplate, follow);
          return compositionTemplate ? {...set, compositionTemplate} : set;
        }),
      );
      addMovement({
        asset: label,
        assetKind: 'TOOL',
        from: 'Ονομασίες εργαλείων',
        to: 'Ονομασίες εργαλείων',
        status: `Έλεγχος ονομασιών · ${changing.length} εργαλεία`,
        by: currentUser.name,
        note: label,
      });
      notify(tr('Άλλαξε η ονομασία σε {0} εργαλεία.', changing.length));
    });
  };
  /** Brings Set compositions in line with the instruments' names (for names changed before they followed). */
  const syncCompositionNames = () => {
    const follow = staleCompositionLines(tools);
    const updated = sets
      .map(set => ({set, compositionTemplate: renameComposition(set.compositionTemplate, follow)}))
      .filter(x => x.compositionTemplate);
    if (!updated.length) return;
    const byId = new Map(updated.map(x => [x.set.id, x.compositionTemplate!]));
    undoable(tr('Συνθέσεις Σετ: ονομασίες σε {0} Σετ', updated.length), () => {
      setSets(list => list.map(set => (byId.has(set.id) ? {...set, compositionTemplate: byId.get(set.id)} : set)));
      addMovement({
        asset: tr('Συνθέσεις Σετ'),
        assetKind: 'SET',
        from: 'Ονομασίες εργαλείων',
        to: 'Συνθέσεις Σετ',
        status: `Έλεγχος ονομασιών · συνθέσεις ${updated.length} Σετ`,
        by: currentUser.name,
      });
      notify(tr('Ενημερώθηκαν οι συνθέσεις {0} Σετ.', updated.length));
    });
  };
  const addToolsToSet = (setId: string, toolIds: string[]) => {
    const target = sets.find(item => item.id === setId);
    if (!target || !toolIds.length) return;
    const chosen = tools.filter(item => toolIds.includes(item.id) && item.setId !== setId);
    setTools(list =>
      list.map(item =>
        toolIds.includes(item.id)
          ? {...item, mode: 'SET_MEMBER' as const, setId: target.id, department: target.department, state: target.state}
          : item,
      ),
    );
    setSets(list =>
      list.map(item => {
        const removed = chosen.filter(tool => tool.setId === item.id).length;
        if (item.id === target.id)
          return {
            ...item,
            actual: item.actual + chosen.length,
            expected: Math.max(item.expected, item.actual + chosen.length),
          };
        return removed ? {...item, actual: Math.max(0, item.actual - removed)} : item;
      }),
    );
    chosen.forEach(tool => {
      const from =
        tool.mode === 'STOCK'
          ? 'Απόθεμα'
          : tool.mode === 'SET_MEMBER'
            ? `Set ${sets.find(item => item.id === tool.setId)?.barcode || ''}`
            : tool.department || 'Μεμονωμένο σε χρήση';
      addMovement({
        asset: `${tool.barcode} · ${tool.name}`,
        assetKind: 'TOOL',
        from,
        to: `Set ${target.barcode}`,
        status: 'Προσθήκη εργαλείου στη σύνθεση Set',
        by: currentUser.name,
      });
    });
    notify(tr('{0} εργαλεία προστέθηκαν στο {1}.', chosen.length, target.barcode));
  };
  const lifecycleAlerts = useMemo(
    () =>
      getLifecycleAlerts(
        sets,
        tools.filter(t => t.state !== 'RETIRED'),
        systemSettings.usageWarningThreshold,
      ),
    [sets, tools, systemSettings.usageWarningThreshold],
  );

  const configureUsageLimit = (kind: AssetKind, id: string, maxUses?: number) => {
    if (!can('asset.usage.configure')) return;
    const normalized = normalizeUsageLimit(maxUses);
    if (kind === 'SET') {
      setSets(list => list.map(item => (item.id === id ? {...item, maxUses: normalized, uses: item.uses || 0} : item)));
    } else {
      setTools(list => list.map(item => (item.id === id ? {...item, maxUses: normalized} : item)));
    }
    notify(normalized ? tr('Ορίστηκε όριο {0} χρήσεων.', normalized) : tr('Το όριο χρήσεων αφαιρέθηκε.'));
  };
  return {
    addToolsToSet,
    configureUsageLimit,
    lifecycleAlerts,
    renameTools,
    syncCompositionNames,
    updateSet,
    updateTool,
  };
}
