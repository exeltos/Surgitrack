import {useState} from 'react';
import {Check, Copy} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';

export default function CopyField({
  value,
  L,
  compact = false,
}: {
  value: string;
  L: (gr: string, en: string) => string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span className={`people-link${compact ? ' compact' : ''}`}>
      <input readOnly value={value} onFocus={e => e.currentTarget.select()} aria-label={L('Σύνδεσμος', 'Link')} />
      <AppButton size="sm" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={() => void copy()}>
        {copied ? L('Αντιγράφηκε', 'Copied') : compact ? L('Σύνδεσμος', 'Link') : L('Αντιγραφή', 'Copy')}
      </AppButton>
    </span>
  );
}
