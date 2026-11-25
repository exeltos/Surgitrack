import {AUTO_END_NOTE} from '../../core/cycleEnd';
import type {useSurgi} from '../../store/SurgiStore';
import {tr} from '../../i18n';
import {formatExpiry, sterileExpiryList} from '../../core/sterileExpiry';
import {isNew} from '../../core/usageStatus';
import {issueWithdrawn} from '../../core/issueOutcome';
import {
  LOAD_STATUS,
  indicatorText,
  sortableTime,
  stateLabel,
  type InventoryGroup,
  type ReportId,
  type Row,
} from './reportsMeta';

type Store = ReturnType<typeof useSurgi>;
/** What the reports are built from. */
export type ReportInput = Pick<
  Store,
  'sets' | 'tools' | 'retiredTools' | 'issues' | 'processLoads' | 'sterilizationReleases' | 'receipts' | 'deliveries'
> & {warningThreshold: number; movements?: Store['movements']; sterilizationCycles?: Store['sterilizationCycles']};
/** The chosen filters; 'ALL' is no filter. */
export type ReportFilters = {
  group: InventoryGroup;
  department: string;
  specialty: string;
  assetKind: string;
  status: string;
  issueStatus: string;
  issueType: string;
  usageFilter: string;
  loadStatus: string;
  sterilizerName: string;
  expiryState: string;
  signature: string;
};

/** One report's columns and rows. */
export function buildReport(
  active: ReportId,
  input: ReportInput,
  filters: ReportFilters,
): {columns: Array<{key: string; label: string}>; rows: Row[]} {
  const {sets, tools, retiredTools, issues, processLoads, sterilizationReleases, receipts, deliveries} = input;
  const {warningThreshold} = input;
  const {
    group,
    department,
    specialty,
    assetKind,
    status,
    issueStatus,
    issueType,
    usageFilter,
    loadStatus,
    sterilizerName,
    expiryState,
    signature,
  } = filters;
  if (active === 'inventory') {
    const assets = [
      ...sets.map(s => ({
        kind: 'Σετ',
        barcode: s.barcode,
        name: s.name,
        department: s.department,
        specialty: s.specialty,
        state: s.state,
        manufacturer: s.manufacturer || '—',
      })),
      ...tools.map(t => ({
        kind: 'Εργαλείο',
        barcode: t.barcode,
        name: t.name,
        department: t.department || 'Απόθεμα',
        specialty: t.specialty,
        state: t.state,
        manufacturer: t.manufacturer || '—',
      })),
    ]
      .filter(a => department === 'ALL' || a.department === department)
      .filter(a => specialty === 'ALL' || a.specialty === specialty)
      .filter(a => assetKind === 'ALL' || (assetKind === 'SET' ? a.kind === 'Σετ' : a.kind === 'Εργαλείο'))
      .filter(a => status === 'ALL' || a.state === status);
    // Grouped by department (or specialty), Sets before instruments, then by name.
    const sorted = assets.sort(
      (a, b) =>
        (group === 'department'
          ? a.department.localeCompare(b.department, 'el')
          : (a.specialty || '').localeCompare(b.specialty || '', 'el')) ||
        b.kind.localeCompare(a.kind, 'el') ||
        a.name.localeCompare(b.name, 'el'),
    );
    return {
      columns: [
        {
          key: group === 'department' ? 'department' : 'specialty',
          label: group === 'department' ? tr('Τμήμα') : tr('Ειδικότητα'),
        },
        {key: 'kind', label: tr('Τύπος')},
        {key: 'barcode', label: 'Barcode'},
        {key: 'name', label: tr('Ονομασία')},
        {key: 'manufacturer', label: tr('Κατασκευαστής')},
        {key: 'stateLabel', label: tr('Κατάσταση')},
      ],
      rows: sorted.map(a => ({...a, stateLabel: stateLabel[a.state] || a.state})) as Row[],
    };
  }
  if (active === 'issues') {
    // A report closed by withdrawing the instrument is not «resolved»: it says «Αποσύρθηκε» (older reports by the
    // text of their resolution), with who made that final assessment (older ones: who recorded the withdrawal).
    const retired = issueWithdrawn;
    const withdrawnBy = (i: (typeof issues)[number]) => {
      const barcode = i.asset.split(' ')[0];
      return input.movements?.find(m => m.asset.startsWith(`${barcode} `) && m.status.startsWith('Απόσυρση'))?.by;
    };
    const statusOf = (i: (typeof issues)[number]) =>
      i.status === 'OPEN' ? 'OPEN' : retired(i) ? 'RETIRED' : 'RESOLVED';
    const rows = issues
      .filter(i => department === 'ALL' || i.department === department)
      .filter(i => issueType === 'ALL' || i.type === issueType)
      .filter(i => issueStatus === 'ALL' || statusOf(i) === issueStatus)
      .map(i => ({
        asset: i.asset,
        type: i.type,
        department: i.department,
        status: statusOf(i) === 'OPEN' ? 'Ανοικτή' : statusOf(i) === 'RETIRED' ? 'Αποσύρθηκε' : 'Επιλυμένη',
        created: i.created,
        reportedBy: i.reportedBy || '—',
        resolvedBy: i.status === 'OPEN' ? '—' : i.resolvedBy || (retired(i) && withdrawnBy(i)) || '—',
        note: i.note,
      }));
    return {
      columns: [
        {key: 'asset', label: tr('Σετ / Εργαλείο')},
        {key: 'type', label: tr('Τύπος')},
        {key: 'department', label: tr('Τμήμα')},
        {key: 'status', label: tr('Κατάσταση')},
        {key: 'created', label: tr('Ημερομηνία')},
        {key: 'reportedBy', label: tr('Δήλωσε')},
        {key: 'resolvedBy', label: tr('Αξιολόγησε')},
        {key: 'note', label: tr('Παρατήρηση')},
      ],
      rows: rows as Row[],
    };
  }
  if (active === 'usage') {
    // Limited-use Sets and instruments in service, those kept until worn, then the instruments taken out of service.
    const inService = [
      ...sets
        .filter(s => s.maxUses)
        .map(s => ({
          kind: 'Σετ',
          barcode: s.barcode,
          name: s.name,
          department: s.department,
          uses: s.uses || 0,
          maxUses: s.maxUses || 0,
          fresh: isNew(s),
        })),
      ...tools
        .filter(t => t.maxUses)
        .map(t => ({
          kind: 'Εργαλείο',
          barcode: t.barcode,
          name: t.name,
          department: t.department || 'Απόθεμα',
          uses: t.uses,
          maxUses: t.maxUses || 0,
          fresh: isNew(t),
        })),
    ]
      .map(a => ({
        ...a,
        remaining: Math.max(0, a.maxUses - a.uses),
        stateLabel: 'Σε χρήση',
        // New: a limit and no use made (see core/usageStatus).
        fresh: a.fresh ? 'Ναι' : '—',
        retiredAt: '',
        reason: '',
      }))
      .sort((a, b) => a.remaining - b.remaining);
    // Instruments kept until they wear out (no number of uses): their uses so far, no limit, after the limited ones.
    const untilWorn = tools
      .filter(t => !t.maxUses && t.wearCheck)
      .map(t => ({
        kind: 'Εργαλείο',
        barcode: t.barcode,
        name: t.name,
        department: t.department || 'Απόθεμα',
        uses: t.uses || 0,
        maxUses: tr('Με έλεγχο φθοράς'),
        remaining: '—',
        stateLabel: 'Σε χρήση',
        fresh: t.uses ? '—' : 'Ναι',
        retiredAt: '',
        reason: '',
      }))
      .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name, 'el'));
    const retired = retiredTools
      .map(t => ({
        kind: 'Εργαλείο',
        barcode: t.barcode,
        name: t.name,
        department: t.department || '—',
        uses: t.uses,
        maxUses: t.maxUses ?? '—',
        remaining: t.maxUses !== undefined ? Math.max(0, t.maxUses - t.uses) : '—',
        stateLabel: 'Εκτός χρήσης',
        fresh: '—',
        retiredAt: t.retiredAt || '—',
        reason: t.retiredReason || '—',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'el') || a.barcode.localeCompare(b.barcode));
    const rows = [
      ...(usageFilter === 'RETIRED'
        ? []
        : inService.filter(
            a =>
              usageFilter === 'ALL' ||
              (usageFilter === 'CRITICAL'
                ? a.remaining > 0 && a.remaining <= warningThreshold
                : usageFilter === 'NEW'
                  ? a.fresh === 'Ναι'
                  : usageFilter === 'USED'
                    ? a.uses > 0 && a.remaining > 0
                    : a.remaining === 0),
          )),
      // Until worn: among all, the unused and the used (they have no limit to reach or come close to).
      ...(usageFilter === 'ALL' || usageFilter === 'NEW' || usageFilter === 'USED'
        ? untilWorn.filter(a => usageFilter === 'ALL' || (usageFilter === 'NEW' ? a.fresh === 'Ναι' : a.uses > 0))
        : []),
      ...(usageFilter === 'ALL' || usageFilter === 'RETIRED' ? retired : []),
    ]
      .filter(a => department === 'ALL' || a.department === department)
      .filter(a => assetKind === 'ALL' || (assetKind === 'SET' ? a.kind === 'Σετ' : a.kind === 'Εργαλείο'));
    return {
      columns: [
        {key: 'kind', label: tr('Τύπος')},
        {key: 'barcode', label: 'Barcode'},
        {key: 'name', label: tr('Ονομασία')},
        {key: 'department', label: tr('Τμήμα')},
        {key: 'uses', label: tr('Χρήσεις')},
        {key: 'maxUses', label: tr('Όριο')},
        {key: 'remaining', label: tr('Υπόλοιπο')},
        {key: 'stateLabel', label: tr('Κατάσταση')},
        {key: 'fresh', label: tr('Αχρησιμοποίητο')},
        {key: 'retiredAt', label: tr('Εκτός χρήσης από')},
        {key: 'reason', label: tr('Αιτία')},
      ],
      rows: rows as Row[],
    };
  }
  if (active === 'loads') {
    const rows = processLoads
      .filter(load => load.kind === 'STERILIZATION')
      .filter(load => loadStatus === 'ALL' || load.status === loadStatus)
      .filter(load => sterilizerName === 'ALL' || load.equipment === sterilizerName)
      .map(load => {
        const release = sterilizationReleases.find(r => r.loadId === load.id);
        // Who ended the cycle («Τέλος κύκλου» or «Αποτυχία κύκλου»): the newest cycle record of its items says it. A
        // cycle that ended by itself has records of its own (sc-auto-…), which no later note or release can change;
        // a load taken back into the sterilizer and ended by hand has a newer, ordinary record.
        const ending = (input.sterilizationCycles || []).find(c => c.loadId === load.id);
        const endedBy = ending?.completedByName;
        const auto = ending
          ? ending.id.startsWith('sc-auto-')
          : !load.reopenedAt && !!load.note?.includes(AUTO_END_NOTE);
        const endedWho = auto ? tr('αυτόματα') : endedBy;
        return {
          loaded: load.createdAt,
          equipment: load.equipment,
          cycle: load.cycleNumber,
          program: load.program,
          items: load.items.length,
          chemical: indicatorText(load.chemicalIndicatorResult),
          biological: indicatorText(load.biologicalIndicatorResult),
          loadStatus: tr(LOAD_STATUS[load.status] || load.status),
          ended: load.completedAt || '—',
          endedBy: endedWho || '—',
          endedInfo: load.completedAt ? [load.completedAt, endedWho].filter(Boolean).join(' · ') : '—',
          released: load.releasedAt || '—',
          releasedBy: release?.releasedByName || '—',
          // On screen: who, under when.
          releasedWho: release?.releasedByName || '',
          endedWho: endedWho || '',
          barcodes: load.items.map(item => item.barcode).join(', '),
          // On screen: the raw values behind the marks and the badge.
          chemicalCode: load.chemicalIndicatorResult || '',
          biologicalCode: load.biologicalIndicatorResult || '',
          loadCode: load.status,
          // On screen fewer, fuller columns; the download and print keep every column.
          cycleProgram: [load.cycleNumber, load.program].filter(Boolean).join(' · '),
          indicators: `${tr('Χημ.')} ${indicatorText(load.chemicalIndicatorResult)} · ${tr('Βιολ.')} ${indicatorText(load.biologicalIndicatorResult)}`,
          releasedInfo: load.releasedAt ? [load.releasedAt, release?.releasedByName].filter(Boolean).join(' · ') : '—',
          maxTemperature: load.cycleData ? `${load.cycleData.maxTemperature.toFixed(1)} °C` : '—',
          maxPressure: load.cycleData ? `${load.cycleData.maxPressure.toFixed(2)} bar` : '—',
          holdMinutes: load.cycleData ? `${load.cycleData.holdMinutes} ${tr('λεπτά')}` : '—',
          parameters: load.cycleData ? (load.cycleData.result === 'PASS' ? tr('Τηρήθηκαν') : tr('Δεν τηρήθηκαν')) : '—',
          dataSource: load.cycleData
            ? load.cycleData.source === 'SIMULATION'
              ? tr('Προσομοίωση')
              : tr('Συσκευή')
            : '—',
          // On screen: the cycle's readings in one column.
          cycleReadings: load.cycleData
            ? [
                `${load.cycleData.maxTemperature.toFixed(1)} °C`,
                `${load.cycleData.maxPressure.toFixed(2)} bar`,
                `${load.cycleData.holdMinutes}′`,
                load.cycleData.result === 'PASS' ? tr('Τηρήθηκαν') : tr('Δεν τηρήθηκαν'),
                load.cycleData.source === 'SIMULATION' ? tr('Προσομοίωση') : '',
              ]
                .filter(Boolean)
                .join(' · ')
            : '—',
        };
      });
    return {
      columns: [
        {key: 'loaded', label: tr('Φόρτωση')},
        {key: 'equipment', label: tr('Κλίβανος')},
        {key: 'cycle', label: tr('Κύκλος')},
        {key: 'program', label: tr('Πρόγραμμα')},
        {key: 'items', label: tr('Αντικείμενα')},
        {key: 'chemical', label: tr('Χημικός δείκτης')},
        {key: 'biological', label: tr('Βιολογικός δείκτης')},
        {key: 'maxTemperature', label: tr('Μέγ. θερμοκρασία')},
        {key: 'maxPressure', label: tr('Μέγ. πίεση')},
        {key: 'holdMinutes', label: tr('Χρόνος αποστείρωσης')},
        {key: 'parameters', label: tr('Παράμετροι κύκλου')},
        {key: 'dataSource', label: tr('Πηγή δεδομένων')},
        {key: 'loadStatus', label: tr('Κατάσταση')},
        {key: 'ended', label: tr('Τέλος κύκλου')},
        {key: 'endedBy', label: tr('Τέλος κύκλου από')},
        {key: 'released', label: tr('Αποδέσμευση')},
        {key: 'releasedBy', label: tr('Αποδέσμευσε')},
        {key: 'barcodes', label: 'Barcodes'},
      ],
      rows: rows as Row[],
    };
  }
  if (active === 'expiry') {
    const rows = sterileExpiryList(sets, tools)
      .filter(e => department === 'ALL' || e.department === department)
      .filter(e => expiryState === 'ALL' || e.state === expiryState)
      .map(e => ({
        kind: e.kind === 'SET' ? 'Σετ' : 'Εργαλείο',
        expiryState: e.state,
        barcode: e.barcode,
        name: e.name,
        department: e.department || '—',
        stateLabel: stateLabel[e.assetState] || e.assetState,
        shelfLife: e.shelfLifeMonths ? tr('{0} μήνες', e.shelfLifeMonths) : '—',
        sterilized: e.sterilizedOn ? formatExpiry(e.sterilizedOn) : '—',
        until: formatExpiry(e.sterileUntil),
        left:
          e.state === 'EXPIRED'
            ? tr('Έληξε πριν {0} ημ.', -e.daysLeft)
            : e.state === 'EXPIRING'
              ? tr('Λήγει σε {0} ημ.', e.daysLeft)
              : tr('{0} ημέρες', e.daysLeft),
      }));
    return {
      columns: [
        {key: 'kind', label: tr('Τύπος')},
        {key: 'barcode', label: 'Barcode'},
        {key: 'name', label: tr('Ονομασία')},
        {key: 'department', label: tr('Τμήμα')},
        {key: 'stateLabel', label: tr('Θέση')},
        {key: 'shelfLife', label: tr('Διάρκεια')},
        {key: 'sterilized', label: tr('Αποστείρωση')},
        {key: 'until', label: tr('Λήξη')},
        {key: 'left', label: tr('Υπόλοιπο')},
      ],
      rows: rows as Row[],
    };
  }
  if (active === 'handovers') {
    // Receipts (department → Sterilization) and deliveries (Sterilization → department), each with
    // whether the server confirmed the other party's signature (see handover_counterparty_stamp).
    const signatureText = (verified?: boolean) =>
      verified === true ? tr('Επιβεβαιωμένη') : verified === false ? tr('Μη επιβεβαιωμένη') : '—';
    const rows = [
      ...receipts.map(r => ({
        type: 'Παραλαβή',
        department: r.fromDepartment,
        verified: r.counterpartyVerified,
        record: r,
      })),
      ...deliveries.map(d => ({
        type: 'Παράδοση',
        department: d.department,
        verified: d.counterpartyVerified,
        record: d,
      })),
    ]
      .filter(h => department === 'ALL' || h.department === department)
      .filter(
        h =>
          signature === 'ALL' ||
          (signature === 'VERIFIED' ? h.verified === true : signature === 'UNVERIFIED' ? h.verified === false : true),
      )
      .sort((a, b) => sortableTime(b.record.at) - sortableTime(a.record.at))
      .map(h => ({
        at: h.record.at,
        type: h.type,
        barcode: h.record.barcode,
        name: h.record.assetName,
        department: h.department || '—',
        deliveredBy: h.record.deliveredByName || '—',
        receivedBy: h.record.receivedByName || '—',
        signature: signatureText(h.verified),
        // On screen only: the handover the row was part of, for its printed slip.
        slipKind: h.type === 'Παραλαβή' ? 'RECEIPT' : 'DELIVERY',
        slipKey: h.record.batchId || h.record.id,
      }));
    return {
      columns: [
        {key: 'at', label: tr('Ημερομηνία')},
        {key: 'type', label: tr('Κίνηση')},
        {key: 'barcode', label: 'Barcode'},
        {key: 'name', label: tr('Ονομασία')},
        {key: 'department', label: tr('Τμήμα')},
        {key: 'deliveredBy', label: tr('Παρέδωσε')},
        {key: 'receivedBy', label: tr('Παρέλαβε')},
        {key: 'signature', label: tr('Υπογραφή άλλου μέρους')},
      ],
      rows: rows as Row[],
    };
  }
  return {columns: [], rows: []};
}
