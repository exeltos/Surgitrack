import {useCallback, useEffect, useState, type ReactNode} from 'react';
import {Check, Copy, Link2, RefreshCw, ShieldOff} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';
import {supabase} from '../../lib/supabase';
import {useAppPreferences} from '../../core/AppPreferences';
import {signupUrl} from '../../data/cloud/accessRequests';

type Link = {token: string; expires_at: string};

/**
 * A hospital's staff signup link: valid 10 days, one per hospital (a new one revokes the old).
 * Used on the hospital admin page and in Studio for the platform admin.
 */
export default function SignupLinkCard({
  organizationId,
  onError,
  children,
}: {
  organizationId: string;
  onError?: (message: string) => void;
  children?: ReactNode;
}) {
  const {lang} = useAppPreferences();
  const el = lang === 'el';
  const L = (gr: string, en: string) => (el ? gr : en);
  const [link, setLink] = useState<Link | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const {data, error} = await supabase
      .from('signup_links')
      .select('token,expires_at')
      .eq('organization_id', organizationId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', {ascending: false})
      .limit(1);
    if (error) onError?.(error.message);
    else setLink(data[0] || null);
  }, [organizationId, onError]);

  useEffect(() => {
    setLink(null);
    void load();
  }, [load]);

  const create = async () => {
    if (
      link &&
      !window.confirm(
        L('Ο τρέχων σύνδεσμος θα πάψει να ισχύει. Συνέχεια;', 'The current link will stop working. Continue?'),
      )
    )
      return;
    const {error} = await supabase.rpc('hospital_create_signup_link', {p_org: organizationId});
    if (error) onError?.(error.message);
    else await load();
  };
  const revoke = async () => {
    if (!window.confirm(L('Ανάκληση του συνδέσμου εγγραφής;', 'Revoke the signup link?'))) return;
    const {error} = await supabase.rpc('hospital_revoke_signup_links', {p_org: organizationId});
    if (error) onError?.(error.message);
    else await load();
  };
  const copy = async () => {
    if (!link) return;
    await navigator.clipboard?.writeText(signupUrl(link.token)).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const expires = link
    ? new Date(link.expires_at).toLocaleString(el ? 'el-GR' : 'en-GB', {dateStyle: 'medium', timeStyle: 'short'})
    : '';

  return (
    <section className="hospital-card hospital-link">
      <header>
        <div>
          <b>{L('Σύνδεσμος εγγραφής', 'Signup link')}</b>
          <small>
            {L(
              'Μοιραστείτε τον με το προσωπικό. Ισχύει 10 ημέρες και είναι μοναδικός για το νοσοκομείο.',
              'Share it with your staff. It is valid for 10 days and unique to this hospital.',
            )}
          </small>
        </div>
        <Link2 size={18} />
      </header>
      {link ? (
        <>
          <div className="hospital-link-box">
            <code>{signupUrl(link.token)}</code>
            <AppButton size="sm" onClick={() => void copy()} icon={copied ? <Check size={14} /> : <Copy size={14} />}>
              {copied ? L('Αντιγράφηκε', 'Copied') : L('Αντιγραφή', 'Copy')}
            </AppButton>
          </div>
          <small className="hospital-link-expiry">
            {L('Λήγει', 'Expires')}: <b>{expires}</b>
          </small>
          <div className="hospital-link-actions">
            <AppButton onClick={() => void create()} icon={<RefreshCw size={14} />}>
              {L('Νέος σύνδεσμος', 'New link')}
            </AppButton>
            <AppButton variant="ghost" onClick={() => void revoke()} icon={<ShieldOff size={14} />}>
              {L('Ανάκληση', 'Revoke')}
            </AppButton>
          </div>
        </>
      ) : (
        <>
          <p className="hospital-empty">{L('Δεν υπάρχει ενεργός σύνδεσμος.', 'There is no active link.')}</p>
          <div className="hospital-link-actions">
            <AppButton variant="primary" onClick={() => void create()} icon={<Link2 size={15} />}>
              {L('Δημιουργία συνδέσμου (10 ημέρες)', 'Create link (10 days)')}
            </AppButton>
          </div>
        </>
      )}
      {children}
    </section>
  );
}
