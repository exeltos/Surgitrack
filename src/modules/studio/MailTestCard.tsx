import {useState} from 'react';
import {CheckCircle2, Mail, Send, XCircle} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {supabase} from '../../lib/supabase';

type MailTest = {
  configured?: boolean;
  ok?: boolean;
  via?: 'smtp' | 'resend' | null;
  error?: string;
  to?: string;
  site?: string;
};

/** Studio → Settings: sends a test email to the platform owner, to check that invitations reach people. */
export default function MailTestCard({L}: {L: (el: string, en: string) => string}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MailTest | undefined>();
  const send = async () => {
    setBusy(true);
    setResult(undefined);
    const {data, error} = await supabase.functions.invoke<MailTest>('mail-test', {
      body: {origin: window.location.origin},
    });
    setBusy(false);
    setResult(error ? {ok: false, error: error.message} : data || {ok: false});
  };
  const via = result?.via === 'resend' ? 'Resend' : 'SMTP';
  return (
    <section className="platform-contact mail-test-card">
      <header>
        <Mail />
        <div>
          <h3>{L('Email της εφαρμογής', 'App emails')}</h3>
          <p>
            {L(
              'Οι προσκλήσεις χρηστών, οι εγκρίσεις και οι ειδοποιήσεις φεύγουν με email. Στείλτε ένα δοκιμαστικό στο email σας για να ελέγξετε ότι φτάνουν.',
              'User invitations, approvals and alerts go out by email. Send a test to your email to check that they arrive.',
            )}
          </p>
        </div>
      </header>
      <div className="mail-test-actions">
        <AppButton variant="primary" icon={<Send size={15} />} disabled={busy} onClick={() => void send()}>
          {busy ? L('Αποστολή…', 'Sending…') : L('Αποστολή δοκιμαστικού email', 'Send a test email')}
        </AppButton>
      </div>
      {result && (
        <div className={`mail-test-result ${result.ok ? 'ok' : 'fail'}`} role="status">
          {result.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <div>
            {result.ok ? (
              <>
                <b>{L(`Στάλθηκε στο ${result.to} (μέσω ${via}).`, `Sent to ${result.to} (via ${via}).`)}</b>
                <small>
                  {L(
                    `Ελέγξτε τα εισερχόμενα και τα ανεπιθύμητα. Οι σύνδεσμοι οδηγούν στο ${result.site}.`,
                    `Check the inbox and the spam folder. The links lead to ${result.site}.`,
                  )}
                </small>
              </>
            ) : result.configured === false ? (
              <>
                <b>{L('Δεν έχει οριστεί τρόπος αποστολής email.', 'No way of sending email is set up.')}</b>
                <small>
                  {L(
                    'Στο Supabase → Edge Functions → Secrets ορίστε SMTP_HOST, SMTP_USER, SMTP_PASS και MAIL_FROM (ή RESEND_API_KEY και MAIL_FROM). Μέχρι τότε, οι προσκλήσεις στέλνονται με το email του Supabase και χωρίς το όνομα χρήστη.',
                    'In Supabase → Edge Functions → Secrets set SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM (or RESEND_API_KEY and MAIL_FROM). Until then, invitations go out with Supabase’s email and without the username.',
                  )}
                </small>
              </>
            ) : (
              <>
                <b>{L('Το email δεν στάλθηκε.', 'The email was not sent.')}</b>
                <small>{result.error || L('Άγνωστο σφάλμα.', 'Unknown error.')}</small>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
