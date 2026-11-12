import {useEffect} from 'react';
import {ExternalLink, FileText, Megaphone} from 'lucide-react';
import {safeLink, type ImageLayout} from '../../data/cloud/platformNotices';
import AppButton from '../ui/AppButton';
import {tr} from '../../i18n';

export type PromoContent = {
  title?: string;
  message: string;
  imageUrl?: string;
  imageLayout?: ImageLayout;
  attachmentUrl?: string;
  attachmentName?: string;
  linkUrl?: string;
  linkLabel?: string;
};

/**
 * A promotion as a card in front of the screen: the picture large, the title, the text and the button to the link.
 * The hospital administrator sees it once on the Overview; the platform owner sees the same card from the preview.
 */
export default function PromoPopup({promo, onClose}: {promo: PromoContent; onClose: () => void}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const image = safeLink(promo.imageUrl);
  const link = safeLink(promo.linkUrl);
  const file = safeLink(promo.attachmentUrl);
  const layout = image ? promo.imageLayout || 'TOP' : 'TOP';
  return (
    <div className="modal-backdrop promo-popup-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <article
        className={`promo-popup layout-${layout.toLowerCase()}`}
        role="dialog"
        aria-modal="true"
        aria-label={promo.title || tr('Πρόταση')}
      >
        {image ? (
          <img className="promo-popup-image" src={image} alt="" />
        ) : (
          <div className="promo-popup-icon" aria-hidden="true">
            <Megaphone size={36} />
          </div>
        )}
        <div className="promo-popup-body">
          <small>{tr('Πρόταση')}</small>
          <h2>{promo.title}</h2>
          <p>{promo.message}</p>
          <div className="promo-popup-actions">
            {link && (
              <a className="promo-cta" href={link} target="_blank" rel="noopener noreferrer">
                {promo.linkLabel || tr('Περισσότερα')} <ExternalLink size={15} aria-hidden="true" />
              </a>
            )}
            {file && (
              <a className="promo-file" href={file} target="_blank" rel="noopener noreferrer">
                <FileText size={16} aria-hidden="true" /> {promo.attachmentName || 'PDF'}
              </a>
            )}
            <AppButton onClick={onClose}>{tr('Κλείσιμο')}</AppButton>
          </div>
        </div>
      </article>
    </div>
  );
}
