import {usesAreCounted} from '../../store/helpers';
import {useState} from 'react';
import {CheckCircle2, ClipboardCheck, Gauge, Printer, Send, ShieldCheck, MessageSquarePlus} from 'lucide-react';
import {useLibraries} from '../../core/LibraryStore';
import {patientCodeRequired} from '../../core/patientCode';
import {countsAtDepartment} from '../../core/surgicalCount';
import type {SurgicalCount} from '../../store/types';
import CountModal from './CountModal';
import {useHasModule} from '../../data/cloud/modulesContext';
import {printCountForm} from './printCountForm';
import AppButton from '../ui/AppButton';
import {useSurgi} from '../../store/SurgiStore';
import type {AssetKind} from '../../types/domain';
import {tr, trData} from '../../i18n';
import {usesThisTime} from '../../core/usageStatus';

export default function DepartmentDispatchModal({
  kind,
  id,
  barcode,
  name,
  onClose,
  atReceipt = false,
  onSent,
}: {
  kind: AssetKind;
  id: string;
  barcode: string;
  name: string;
  onClose: () => void;
  /**
   * Sterilization at the receipt, for an item the department brought by hand without sending it: the same questions
   * (patient, the uses), recorded by the one receiving it, with no count of the department's.
   */
  atReceipt?: boolean;
  /** After the item is recorded as sent (at the receipt: so it joins the receipt). */
  onSent?: () => void;
}) {
  const {currentUser, sendToSterilization, sets, tools, preparations, sterilizationReleases, organizationName} =
    useSurgi();
  const {systemSettings} = useLibraries();
  const [patientCode, setPatientCode] = useState('');
  const [note, setNote] = useState('');
  const [livesConfirmed, setLivesConfirmed] = useState(false);
  // Operating theatres sign the instrument count (its own window) before the Set can be sent.
  const asset = kind === 'SET' ? sets.find(x => x.id === id) : tools.find(x => x.id === id);
  const withCount = useHasModule('SURGICAL_COUNT');
  const counting =
    withCount && !atReceipt && countsAtDepartment(asset?.department, systemSettings.surgicalCountDepartments);
  const [countOpen, setCountOpen] = useState(false);
  const [count, setCount] = useState<SurgicalCount | null>(null);
  const printSigned = () =>
    asset &&
    count &&
    printCountForm({
      asset,
      items: kind === 'SET' ? tools.filter(t => t.setId === id && t.state !== 'RETIRED') : [asset],
      hospital: organizationName,
      preparation: preparations.find(r => r.assetId === id),
      release: sterilizationReleases.find(r => r.assetId === id && r.decision === 'RELEASED'),
      count,
    });
  // Limited-use (multi-use with lives) instruments lose one life on every dispatch after a procedure.
  const limitedTools =
    kind === 'TOOL'
      ? tools.filter(t => t.id === id && usesAreCounted(t))
      : tools.filter(t => t.setId === id && usesAreCounted(t));
  const limitedSet = kind === 'SET' && !!sets.find(s => s.id === id)?.maxUses;
  // Limited-use instruments not used this time (the Set was opened, the instrument was not): no use recorded.
  const [unused, setUnused] = useState<Set<string>>(new Set());
  const usedTools = limitedTools.filter(t => !unused.has(t.id));
  // Instruments used several times in the operation (a clip applier): how many uses, typed in for each.
  const [clips, setClips] = useState<Record<string, string>>({});
  const several = usedTools.filter(t => t.multiUse && t.maxUses);
  const clipsGiven = several.every(t => Number(clips[t.id]) >= 1);
  const usesById = Object.fromEntries(several.map(t => [t.id, usesThisTime(t, Number(clips[t.id]))]));
  const consumesLives = usedTools.length > 0 || limitedSet;
  const toggleUnused = (toolId: string) =>
    setUnused(current => {
      const next = new Set(current);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  // The department may require the patient code (Organization → Departments); limited-use instruments sent back
  // unused (no use recorded) were used on no patient, so they do not ask for it.
  // A Set may hold instruments without a limit that were used: only a standalone instrument is exempt.
  const sentUnused = kind === 'TOOL' && limitedTools.length > 0 && !consumesLives;
  const patientRequired = consumesLives || (!sentUnused && patientCodeRequired(asset?.department, systemSettings));
  const canSend =
    (!counting || !!count) &&
    (!patientRequired || patientCode.trim().length > 0) &&
    (!consumesLives || livesConfirmed) &&
    clipsGiven;
  const send = () => {
    if (!canSend) return;
    // Refused (used up, recalled): nothing was recorded, so the dialog stays and nothing is said to be sent.
    if (
      !sendToSterilization(
        kind,
        id,
        patientCode.trim() || undefined,
        note.trim() || undefined,
        [...unused],
        usesById,
        atReceipt,
      )
    )
      return;
    onSent?.();
    onClose();
  };
  return (
    <div
      className="modal-backdrop department-modal-backdrop"
      onMouseDown={e => e.currentTarget === e.target && onClose()}
    >
      <div className="asset-modal department-send-modal">
        <header>
          <div>
            <span className="eyebrow">
              {atReceipt ? tr('Παραλαβή χωρίς ηλεκτρονική αποστολή') : tr('Ηλεκτρονική προώθηση')}
            </span>
            <h2>{atReceipt ? tr('Δεν στάλθηκε από το τμήμα') : tr('Αποστολή προς Αποστείρωση')}</h2>
            <p>
              {barcode} · {name}
            </p>
            {atReceipt && (
              <p className="department-send-at-receipt">
                {tr(
                  'Χρησιμοποιήθηκε σε ασθενή; Γράψτε τον κωδικό ασθενούς για να αφαιρεθεί η χρήση. Ξετσεκάρετε όσα δεν χρησιμοποιήθηκαν.',
                )}
              </p>
            )}
          </div>
        </header>
        <div className="modal-body department-send-body">
          <div className="department-send-route">
            <div>
              <span>{tr('Από')}</span>
              <strong>{trData(atReceipt ? asset?.department : currentUser.department)}</strong>
            </div>
            <Send size={22} />
            <div>
              <span>{tr('Προς')}</span>
              <strong>{tr('Κεντρική Αποστείρωση')}</strong>
            </div>
          </div>
          <label className="department-patient-code">
            {tr('Κωδικός ασθενούς') + ' '}
            <small>
              {consumesLives
                ? tr('υποχρεωτικός · εργαλείο περιορισμένων χρήσεων, όχι ονοματεπώνυμο')
                : patientRequired
                  ? tr('υποχρεωτικός για το τμήμα · όχι ονοματεπώνυμο')
                  : tr('προαιρετικός · μόνο για ιχνηλασιμότητα, όχι ονοματεπώνυμο')}
            </small>
            <input
              value={patientCode}
              onChange={e => setPatientCode(e.target.value)}
              placeholder={tr('π.χ. PT-2026-00125')}
            />
          </label>
          {counting && (
            <div className={`department-count-step ${count ? 'signed' : ''}`}>
              {count ? <CheckCircle2 size={20} /> : <ClipboardCheck size={20} />}
              <div>
                <strong>{tr('Καταμέτρηση εργαλείων')}</strong>
                <small>
                  {count
                    ? tr('Υπογεγραμμένη · {0} από {1} · {2} {3}', count.counted, count.expected, count.by, count.at)
                    : tr('Απαιτείται πριν την αποστολή · χειρουργείο')}
                </small>
                {count?.missing?.length ? (
                  <small className="missing">{tr('Λείπουν: {0}', count.missing.join(', '))}</small>
                ) : null}
              </div>
              {count ? (
                <AppButton icon={<Printer size={15} />} onClick={printSigned}>
                  {tr('Έντυπο')}
                </AppButton>
              ) : (
                <AppButton variant="primary" icon={<ClipboardCheck size={15} />} onClick={() => setCountOpen(true)}>
                  {tr('Καταμέτρηση')}
                </AppButton>
              )}
            </div>
          )}
          {(limitedTools.length > 0 || limitedSet) && (
            <div className="department-lives-card">
              <div className="department-lives-head">
                <Gauge size={18} />
                <strong>{tr('Καταγραφή χρήσης')}</strong>
                <small>{tr('Υπόλοιπο χρήσεων')}</small>
              </div>
              <ul>
                {limitedTools.map(t => {
                  const remaining = Math.max(0, (t.maxUses || 0) - t.uses);
                  const noLimit = !t.maxUses;
                  const used = !unused.has(t.id);
                  const many = used && !!t.multiUse && !noLimit;
                  const typed = Number(clips[t.id]);
                  const take = many ? (typed >= 1 ? usesThisTime(t, typed) : 0) : 1;
                  return (
                    <li
                      key={t.id}
                      className={`${used && !noLimit && remaining - take <= 0 ? 'last-life' : ''} ${used ? '' : 'not-used'}`}
                    >
                      <label className="department-lives-used" title={tr('Χρησιμοποιήθηκε')}>
                        <input
                          type="checkbox"
                          checked={used}
                          onChange={() => toggleUnused(t.id)}
                          aria-label={tr('Χρησιμοποιήθηκε: {0}', t.barcode)}
                        />
                        <span>
                          {t.barcode} · {t.name}
                        </span>
                      </label>
                      <b>
                        {!used
                          ? tr('χωρίς χρήση')
                          : noLimit
                            ? `${t.uses} → ${t.uses + 1}`
                            : `${remaining} → ${Math.max(0, remaining - take)}`}
                      </b>
                      {many && (
                        <label className="department-lives-clips">
                          <span>{tr('Clips / χρήσεις')}</span>
                          <input
                            type="number"
                            min={1}
                            max={remaining || undefined}
                            inputMode="numeric"
                            value={clips[t.id] || ''}
                            placeholder="—"
                            onChange={e => setClips(c => ({...c, [t.id]: e.target.value}))}
                            aria-label={tr('Clips / χρήσεις: {0}', t.barcode)}
                          />
                        </label>
                      )}
                      {many && typed > remaining && (
                        <small>{tr('Απομένουν μόνο {0} χρήσεις: καταγράφονται {0}.', remaining)}</small>
                      )}
                      {used && !noLimit && remaining - take <= 0 && (!many || typed >= 1) && (
                        <small>{tr('Τελευταία χρήση · θα τεθεί εκτός χρήσης')}</small>
                      )}
                    </li>
                  );
                })}
              </ul>
              <small className="department-lives-hint">
                {tr('Ξετσεκάρετε όσα δεν χρησιμοποιήθηκαν: στέλνονται χωρίς να αφαιρεθεί χρήση.')}
              </small>
              {consumesLives && (
                <label className="department-lives-confirm">
                  <input type="checkbox" checked={livesConfirmed} onChange={e => setLivesConfirmed(e.target.checked)} />
                  {several.length
                    ? tr('Επιβεβαιώνω ότι χρησιμοποιήθηκε (καταγράφονται οι χρήσεις που έγραψα)')
                    : tr('Επιβεβαιώνω ότι χρησιμοποιήθηκε (καταγράφεται μία χρήση)')}
                </label>
              )}
            </div>
          )}
          <div className="department-signature-card">
            <ShieldCheck size={21} />
            <div>
              <span>{atReceipt ? tr('Καταγράφει') : tr('Αποστέλλει')}</span>
              <strong>{currentUser.name}</strong>
              <small>
                {trData(currentUser.department)} {tr('· η ενέργεια καταγράφεται αυτόματα στο ιστορικό')}
              </small>
            </div>
          </div>
          <label className="department-send-note">
            <span>
              <MessageSquarePlus size={16} />
              <strong>{tr('Παρατήρηση αποστολής')}</strong>
              <small>{tr('προαιρετική')}</small>
            </span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={tr('Π.χ. ειδική παρατήρηση μεταφοράς ή κατάστασης…')}
            />
          </label>
        </div>
        <footer>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton variant="primary" icon={<Send size={17} />} onClick={send} disabled={!canSend}>
            {atReceipt ? tr('Καταγραφή και παραλαβή') : tr('Αποστολή προς Αποστείρωση')}
          </AppButton>
        </footer>
      </div>
      {countOpen && (
        <CountModal
          kind={kind}
          id={id}
          patientCode={patientCode}
          onClose={() => setCountOpen(false)}
          onSigned={signed => {
            setCount(signed);
            setPatientCode(signed.patientCode);
            setCountOpen(false);
          }}
        />
      )}
    </div>
  );
}
