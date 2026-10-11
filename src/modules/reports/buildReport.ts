import type {useSurgi} from '../../store/SurgiStore';
import {tr} from '../../i18n';
import {formatExpiry, sterileExpiryList} from '../../core/sterileExpiry';
import {LOAD_STATUS, indicatorText, sortableTime, stateLabel, type ReportId, type Row} from './reportsMeta';

type Store = ReturnType<typeof useSurgi>;
/** What the reports are built from. */
export type ReportInput = Pick<
  Store,
  | 'sets'
  | 'tools'
  | 'retiredTools'
  | 'issues'
  | 'movements'
  | 'processLoads'
  | 'sterilizationReleases'
  | 'receipts'
  | 'deliveries'
> & {warningThreshold: number};
/** The chosen filters; 'ALL' (or an empty patient code) is no filter. */
export type ReportFilters = {
  setId: string;
  department: string;
  specialty: string;
  assetKind: string;
  status: string;
  issueStatus: string;
  issueType: string;
  usageFilter: string;
  patientCode: string;
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
  const {sets, tools, retiredTools, issues, movements, processLoads, sterilizationReleases, receipts, deliveries} =
    input;
  const {warningThreshold} = input;
  const {
    setId,
    department,
    specialty,
    assetKind,
    status,
    issueStatus,
    issueType,
    usageFilter,
    patientCode,
    loadStatus,
    sterilizerName,
    expiryState,
    signature,
  } = filters;
  if (active === 'composition') {
    const set = sets.find(s => s.id === setId) || sets[0];
    const members = set ? tools.filter(t => t.setId === set.id) : [];
    return {
      columns: [
        {key: 'barcode', label: 'Barcode'},
        {key: 'name', label: tr('Εργαλείο')},
        {key: 'code', label: tr('Κωδικός')},
        {key: 'manufacturer', label: tr('Κατασκευαστής')},
        {key: 'uses', label: tr('Χρήσεις')},
      ],
      rows: members.map(t => ({
        barcode: t.barcode,
        name: t.name,
        code: t.code,
        manufacturer: t.manufacturer || '—',
        uses: t.maxUses ? `${t.uses}/${t.maxUses}` : tr('{0} · χωρίς όριο', t.uses),
      })) as Row[],
    };
  }
  if (active === 'department' || active === 'specialty') {
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
        (active === 'department'
          ? a.department.localeCompare(b.department, 'el')
          : (a.specialty || '').localeCompare(b.specialty || '', 'el')) ||
        b.kind.localeCompare(a.kind, 'el') ||
        a.name.localeCompare(b.name, 'el'),
    );
    return {
      columns: [
        {
          key: active === 'department' ? 'department' : 'specialty',
          label: active === 'department' ? tr('Τμήμα') : tr('Ειδικότητα'),
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
    const rows = issues
      .filter(i => department === 'ALL' || i.department === department)
      .filter(i => issueType === 'ALL' || i.type === issueType)
      .filter(i => issueStatus === 'ALL' || i.status === issueStatus)
      .map(i => ({
        asset: i.asset,
        type: i.type,
        department: i.department,
        status: i.status === 'OPEN' ? 'Ανοιχτή' : 'Ολοκληρωμένη',
        created: i.created,
        note: i.note,
      }));
    return {
      columns: [
        {key: 'asset', label: tr('Σετ / Εργαλείο')},
        {key: 'type', label: tr('Τύπος')},
        {key: 'department', label: tr('Τμήμα')},
        {key: 'status', label: tr('Κατάσταση')},
        {key: 'created', label: tr('Ημερομηνία')},
        {key: 'note', label: tr('Παρατήρηση')},
      ],
      rows: rows as Row[],
    };
  }
  if (active === 'usage') {
    const assets = [
      ...sets
        .filter(s => s.maxUses)
        .map(s => ({
          kind: 'Σετ',
          barcode: s.barcode,
          name: s.name,
          department: s.department,
          uses: s.uses || 0,
          maxUses: s.maxUses || 0,
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
        })),
    ]
      .map(a => ({...a, remaining: Math.max(0, a.maxUses - a.uses)}))
      .filter(a => department === 'ALL' || a.department === department)
      .filter(a => assetKind === 'ALL' || (assetKind === 'SET' ? a.kind === 'Σετ' : a.kind === 'Εργαλείο'))
      .filter(
        a =>
          usageFilter === 'ALL' || (usageFilter === 'CRITICAL' ? a.remaining <= warningThreshold : a.remaining === 0),
      )
      .sort((a, b) => a.remaining - b.remaining);
    return {
      columns: [
        {key: 'kind', label: tr('Τύπος')},
        {key: 'barcode', label: 'Barcode'},
        {key: 'name', label: tr('Ονομασία')},
        {key: 'department', label: tr('Τμήμα')},
        {key: 'uses', label: tr('Χρήσεις')},
        {key: 'maxUses', label: tr('Όριο')},
        {key: 'remaining', label: tr('Υπόλοιπο')},
      ],
      rows: assets as Row[],
    };
  }
  if (active === 'retired') {
    const rows = retiredTools
      .filter(t => specialty === 'ALL' || t.specialty === specialty)
      .map(t => ({
        barcode: t.barcode,
        name: t.name,
        code: t.code,
        manufacturer: t.manufacturer || '—',
        specialty: t.specialty || '—',
        uses: t.maxUses !== undefined ? `${t.uses}/${t.maxUses}` : String(t.uses),
        retiredAt: t.retiredAt || '—',
        reason: t.retiredReason || '—',
        notes: t.notes || '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'el') || a.barcode.localeCompare(b.barcode));
    return {
      columns: [
        {key: 'barcode', label: 'Barcode'},
        {key: 'name', label: tr('Εργαλείο')},
        {key: 'code', label: tr('Κωδικός')},
        {key: 'manufacturer', label: tr('Κατασκευαστής')},
        {key: 'specialty', label: tr('Ειδικότητα')},
        {key: 'uses', label: tr('Χρήσεις')},
        {key: 'retiredAt', label: tr('Εκτός χρήσης από')},
        {key: 'reason', label: tr('Αιτία')},
        {key: 'notes', label: tr('Σημειώσεις')},
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
        return {
          loaded: load.createdAt,
          equipment: load.equipment,
          cycle: load.cycleNumber,
          program: load.program,
          items: load.items.length,
          chemical: indicatorText(load.chemicalIndicatorResult),
          biological: indicatorText(load.biologicalIndicatorResult),
          loadStatus: tr(LOAD_STATUS[load.status] || load.status),
          released: load.releasedAt || '—',
          releasedBy: release?.releasedByName || '—',
          barcodes: load.items.map(item => item.barcode).join(', '),
          // On screen fewer, fuller columns; the download and print keep every column.
          cycleProgram: [load.cycleNumber, load.program].filter(Boolean).join(' · '),
          indicators: `${tr('Χημ.')} ${indicatorText(load.chemicalIndicatorResult)} · ${tr('Βιολ.')} ${indicatorText(load.biologicalIndicatorResult)}`,
          releasedInfo: load.releasedAt ? [load.releasedAt, release?.releasedByName].filter(Boolean).join(' · ') : '—',
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
        {key: 'loadStatus', label: tr('Κατάσταση')},
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
  const q = patientCode.trim().toLowerCase();
  const rows = movements
    .filter(m => m.patientCode && (!q || m.patientCode.toLowerCase().includes(q)))
    .map(m => ({
      patientCode: m.patientCode || '',
      asset: m.asset,
      kind: m.assetKind === 'SET' ? 'Σετ' : 'Εργαλείο',
      from: m.from,
      to: m.to,
      status: m.status,
      at: m.at,
      by: m.by,
    }));
  return {
    columns: [
      {key: 'patientCode', label: tr('Κωδικός ασθενούς')},
      {key: 'asset', label: tr('Σετ / Εργαλείο')},
      {key: 'kind', label: tr('Τύπος')},
      {key: 'from', label: tr('Από')},
      {key: 'to', label: tr('Προς')},
      {key: 'status', label: tr('Κίνηση')},
      {key: 'at', label: tr('Ημερομηνία')},
      {key: 'by', label: tr('Χρήστης')},
    ],
    rows: rows as Row[],
  };
}
