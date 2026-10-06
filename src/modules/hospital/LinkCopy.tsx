import {useState} from 'react';
import {Check, Copy} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import type {Member} from './hospitalPeopleMeta';

export default function LinkCopy({
  member,
  make,
  busy,
  L,
}: {
  member: Member;
  make: (member: Member) => Promise<string | undefined>;
  busy: boolean;
  L: (gr: string, en: string) => string;
}) {
  const [url, setUrl] = useState('');
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const create = async () => {
    setWorking(true);
    const made = await make(member);
    setWorking(false);
    if (!made) return;
    setUrl(made);
    await copy(made);
  };
  if (!url)
    return (
      <AppButton size="sm" disabled={busy || working} icon={<Copy size={14} />} onClick={() => void create()}>
        {working ? L('Δημιουργία…', 'Making…') : L('Αντιγραφή συνδέσμου', 'Copy link')}
      </AppButton>
    );
  return (
    <div className="people-link">
      <input readOnly value={url} onFocus={e => e.currentTarget.select()} aria-label={L('Σύνδεσμος', 'Link')} />
      <AppButton size="sm" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={() => void copy(url)}>
        {copied ? L('Αντιγράφηκε', 'Copied') : L('Αντιγραφή', 'Copy')}
      </AppButton>
      <small>
        {url.includes('st_token=demo-') &&
          L('Demo: ενδεικτικός σύνδεσμος, δεν ανοίγει λογαριασμό. ', 'Demo: a sample link; it opens no account. ')}
        {L(
          'Στείλτε τον με όποιον τρόπο θέλετε (μήνυμα, Viber κλπ.). Ισχύει μία φορά και για περιορισμένο χρόνο· μην τον δώσετε σε άλλον.',
          'Send it any way you like (message, chat). It works once and for a limited time; do not give it to anyone else.',
        )}
      </small>
    </div>
  );
}
