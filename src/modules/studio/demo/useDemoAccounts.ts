import {useCallback, useEffect, useState} from 'react';
import {DEMO_EXTENSION_DAYS, demoNextStep, type DemoAccount} from '../../../core/demoAccounts';
import {trialEndAfter, trialEnded} from '../../../core/trial';
import {
  convertDemoAccount,
  createDemoAccount,
  deleteDemoAccount,
  loadDemoAccounts,
  resetDemoAccount,
  seedDemoAccount,
  sendDemoInvite,
  setDemoEnd,
  markDemoRequestHandled,
  setDemoAutoDelete,
  setDemoUserLimit,
  type DemoConversion,
  type NewDemo,
} from '../../../data/cloud/demoAccounts';
import {switchHospital} from '../../../data/cloud/hospitalSwitch';
import {tr} from '../../../i18n';

const message = (e: unknown) => (e instanceof Error ? e.message : String((e as {message?: string})?.message || e));

/** What the panel says after an action: done, a link to pass on by hand, or what failed. */
export type DemoNotice = {kind: 'ok' | 'error' | 'link'; text: string; url?: string};

/** The platform owner's evaluation Demos: open one, finish its preparation, extend, reset, enter. */
export function useDemoAccounts() {
  const [demos, setDemos] = useState<DemoAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<{id: string; label: string} | null>(null);
  const [notice, setNotice] = useState<DemoNotice | null>(null);

  const load = useCallback(async () => {
    try {
      setDemos(await loadDemoAccounts());
    } catch (e) {
      setNotice({kind: 'error', text: message(e)});
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  /** The sample data first, then the email: a Demo stopped half-way carries on from where it stopped. */
  const prepare = async (
    demo: Pick<DemoAccount, 'id' | 'organizationId' | 'seededAt' | 'status'>,
    screenGuides?: boolean,
  ) => {
    if (demoNextStep(demo) === 'SEED') {
      setBusy({id: demo.id, label: tr('Φόρτωση δοκιμαστικών δεδομένων…')});
      await seedDemoAccount(
        demo,
        (done, total) =>
          setBusy({id: demo.id, label: tr('Φόρτωση δοκιμαστικών δεδομένων… {0}%', Math.round((done / total) * 100))}),
        'SEED',
        screenGuides,
      );
    }
    setBusy({id: demo.id, label: tr('Αποστολή email…')});
    const sent = await sendDemoInvite(demo.id);
    setNotice(
      sent.emailed
        ? {kind: 'ok', text: tr('Το Demo είναι έτοιμο και το email στάλθηκε. Όνομα χρήστη: {0}', sent.user_code)}
        : {
            kind: 'link',
            text: tr('Το Demo είναι έτοιμο, αλλά το email δεν στάλθηκε. Στείλτε στον υπεύθυνο αυτόν τον σύνδεσμο:'),
            url: sent.url,
          },
    );
  };

  const run = async (id: string, label: string, action: () => Promise<void>) => {
    setBusy({id, label});
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setNotice({kind: 'error', text: message(e)});
    } finally {
      setBusy(null);
      await load();
    }
  };

  const create = (demo: NewDemo) =>
    run('new', tr('Δημιουργία Demo…'), async () => {
      const created = await createDemoAccount(demo);
      await prepare({id: created.id, organizationId: created.organization_id, status: 'PREPARING'}, demo.screenGuides);
    });
  const continuePreparing = (demo: DemoAccount) => run(demo.id, tr('Προετοιμασία…'), () => prepare(demo));
  const resend = (demo: DemoAccount) =>
    run(demo.id, tr('Αποστολή email…'), async () => {
      const sent = await sendDemoInvite(demo.id);
      setNotice(
        sent.emailed
          ? {kind: 'ok', text: tr('Το email στάλθηκε ξανά στο {0}.', demo.contactEmail)}
          : {kind: 'link', text: tr('Το email δεν στάλθηκε. Στείλτε στον υπεύθυνο αυτόν τον σύνδεσμο:'), url: sent.url},
      );
    });
  /** A week more, from the current end (or from today once it has ended). */
  const extend = (demo: DemoAccount) =>
    run(demo.id, tr('Αποθήκευση…'), async () => {
      const from = !demo.endsAt || trialEnded('TRIAL', demo.endsAt) ? new Date() : new Date(demo.endsAt);
      await setDemoEnd(demo.organizationId, trialEndAfter(DEMO_EXTENSION_DAYS, from));
    });
  const changeEnd = (demo: DemoAccount, endsAt: string) =>
    run(demo.id, tr('Αποθήκευση…'), () => setDemoEnd(demo.organizationId, endsAt));
  const reset = (demo: DemoAccount) =>
    run(demo.id, tr('Επαναφορά δεδομένων…'), async () => {
      await resetDemoAccount(demo);
      setNotice({
        kind: 'ok',
        text: tr('Τα δεδομένα του «{0}» επανήλθαν στα αρχικά δοκιμαστικά.', demo.organizationName),
      });
    });
  const changeLimit = (demo: DemoAccount, limit: number) =>
    run(demo.id, tr('Αποθήκευση…'), () => setDemoUserLimit(demo.id, limit));
  const changeAutoDelete = (demo: DemoAccount, autoDelete: boolean) =>
    run(demo.id, tr('Αποθήκευση…'), () => setDemoAutoDelete(demo.id, autoDelete));
  const convert = (demo: DemoAccount, conversion: DemoConversion) =>
    run(demo.id, tr('Μετατροπή σε πελάτη…'), async () => {
      try {
        await convertDemoAccount(demo.id, conversion);
      } catch (e) {
        throw /organizations_code_key/.test(message(e)) ? new Error(tr('Ο κωδικός νοσοκομείου υπάρχει ήδη.')) : e;
      }
      setNotice({
        kind: 'ok',
        text: tr('Το «{0}» έγινε πελάτης και εμφανίζεται στα Νοσοκομεία.', conversion.name),
      });
    });
  const remove = (demo: DemoAccount) =>
    run(demo.id, tr('Διαγραφή…'), async () => {
      await deleteDemoAccount(demo.id);
      setNotice({kind: 'ok', text: tr('Το «{0}» διαγράφηκε οριστικά.', demo.organizationName)});
    });
  const handleRequest = (demo: DemoAccount, requestId: string) =>
    run(demo.id, tr('Αποθήκευση…'), () => markDemoRequestHandled(requestId));
  const enter = (demo: DemoAccount) => switchHospital(demo.organizationId, '#/');

  return {
    demos,
    loading,
    busy,
    notice,
    setNotice,
    create,
    continuePreparing,
    resend,
    extend,
    changeEnd,
    changeLimit,
    handleRequest,
    changeAutoDelete,
    convert,
    remove,
    reset,
    enter,
  };
}
