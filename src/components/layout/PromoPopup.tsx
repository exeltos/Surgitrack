import {useEffect} from 'react';
import {ExternalLink, Megaphone, X} from 'lucide-react';
import {safeLink} from '../../data/cloud/platformNotices';
import {tr} from '../../i18n';

export type PromoContent = {
  title?: string;
  message: string;
  imageUrl?: string;
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
  return (
    <div className="modal-backdrop promo-popup-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <article className="promo-popup" role="dialog" aria-modal="true" aria-label={promo.title || tr('Πρόταση')}>
        <button type="button" className="icon-button promo-popup-x" onClick={onClose} aria-label={tr('Κλείσιμο')}>
          <X size={18} />
        </button>
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
            <button type="button" className="promo-popup-close" onClick={onClose}>
              {tr('Κλείσιμο')}
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
