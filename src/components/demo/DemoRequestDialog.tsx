import {useState} from 'react';
import {CheckCircle2, X} from 'lucide-react';
import {sendDemoRequest, type DemoRequestKind} from '../../data/cloud/demoFeedback';

/**
 * "I want the application" / "I need more time" from a prospect's Demo (also once it has ended).
 * The request is saved for the platform owner, who is emailed about it.
 */
export default function DemoRequestDialog({
  kind,
  organizationId,
  userId,
  L,
  onClose,
}: {
  kind: DemoRequestKind;
  organizationId: string;
  userId: string;
  L: (el: string, en: string) => string;
  onClose: () => void;
}) {
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'form' | 'sending' | 'sent' | 'error'>('form');
  const purchase = kind === 'PURCHASE';
  const send = async () => {
    setState('sending');
    try {
      await sendDemoRequest(organizationId, userId, {
        kind,
        contactName: contactName.trim(),
        phone: phone.trim(),
        message: message.trim(),
      });
      setState('sent');
    } catch {
      setState('error');
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <div
        className="demo-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={
          purchase ? L('Θέλω την εφαρμογή', 'I want the application') : L('Ζητώ παράταση', 'Ask for more time')
        }
      >
        <header>
          <h3>
            {purchase ? L('Θέλω την εφαρμογή', 'I want the application') : L('Ζητώ παράταση', 'Ask for more time')}
          </h3>
          <button type="button" onClick={onClose} aria-label={L('Κλείσιμο', 'Close')}>
            <X size={18} />
          </button>
        </header>
        {state === 'sent' ? (
          <div className="demo-dialog-done">
            <CheckCircle2 size={28} />
            <p>
              {purchase
                ? L(
                    'Ευχαριστούμε! Λάβαμε το ενδιαφέρον σας και θα επικοινωνήσουμε μαζί σας σύντομα.',
                    'Thank you! We received your interest and will contact you soon.',
                  )
                : L(
                    'Ευχαριστούμε! Λάβαμε το αίτημα παράτασης και θα σας ενημερώσουμε σύντομα.',
                    'Thank you! We received your request for more time and will let you know soon.',
                  )}
            </p>
            <button type="button" className="demo-dialog-primary" onClick={onClose}>
              {L('Κλείσιμο', 'Close')}
            </button>
          </div>
        ) : (
          <>
            <p className="demo-dialog-intro">
              {purchase
                ? L(
                    'Αφήστε μας ένα τηλέφωνο και ό,τι θέλετε να μας πείτε· θα επικοινωνήσουμε για τα επόμενα βήματα.',
                    'Leave a phone number and anything you want to tell us; we will contact you about the next steps.',
                  )
                : L(
                    'Πείτε μας πόσο χρόνο χρειάζεστε ακόμα και γιατί· θα σας απαντήσουμε σύντομα.',
                    'Tell us how much more time you need and why; we will answer soon.',
                  )}
            </p>
            <label>
              {L('Ονοματεπώνυμο', 'Full name')}
              <input value={contactName} maxLength={120} onChange={e => setContactName(e.target.value)} />
            </label>
            <label>
              {L('Τηλέφωνο', 'Phone')}
              <input type="tel" value={phone} maxLength={40} onChange={e => setPhone(e.target.value)} />
            </label>
            <label>
              {L('Μήνυμα', 'Message')}
              <textarea rows={3} value={message} maxLength={2000} onChange={e => setMessage(e.target.value)} />
            </label>
            {state === 'error' && (
              <p className="demo-dialog-error">{L('Δεν στάλθηκε. Δοκιμάστε ξανά.', 'It was not sent. Try again.')}</p>
            )}
            <footer>
              <button type="button" onClick={onClose}>
                {L('Ακύρωση', 'Cancel')}
              </button>
              <button
                type="button"
                className="demo-dialog-primary"
                disabled={state === 'sending'}
                onClick={() => void send()}
              >
                {state === 'sending' ? L('Αποστολή…', 'Sending…') : L('Αποστολή', 'Send')}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
