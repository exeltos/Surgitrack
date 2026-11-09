import {useEffect, useState} from 'react';
import {ExternalLink, Megaphone, X} from 'lucide-react';
import {getRuntimeDataMode} from '../../config/dataMode';
import {loadActiveNotices, safeLink, type PlatformNotice} from '../../data/cloud/platformNotices';
import {tr} from '../../i18n';

const HIDDEN = 'surgitrack-promos-hidden';
const REFRESH_MS = 10 * 60_000;

const readHidden = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN) || '[]') as string[];
  } catch {
    return [];
  }
};

/**
 * The platform owner's promotions (Studio → Ειδοποιήσεις) as cards at the top of the hospital administrator's Overview:
 * a title, the text and a link that opens in a new tab. The database shows an administrator only the promotions for
 * their hospital; each can be hidden, and stays hidden on this device.
 */
export default function PromoCards() {
  const [promos, setPromos] = useState<PlatformNotice[]>([]);
  const [hidden, setHidden] = useState<string[]>(readHidden);
  const [broken, setBroken] = useState<string[]>([]);
  useEffect(() => {
    if (getRuntimeDataMode() !== 'PRODUCTION') return;
    let live = true;
    const load = () => void loadActiveNotices('PROMO').then(list => live && setPromos(list));
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);
  const shown = promos.filter(promo => !hidden.includes(promo.id));
  if (!shown.length) return null;
  const hide = (id: string) => {
    const next = [...hidden, id];
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN, JSON.stringify(next));
    } catch {
      // Private mode: hidden until the page reloads.
    }
  };
  return (
    <div className="promo-cards">
      {shown.map(promo => {
        const link = safeLink(promo.linkUrl);
        const image = broken.includes(promo.id) ? undefined : safeLink(promo.imageUrl);
        return (
          <article key={promo.id} className="promo-card" aria-label={promo.title}>
            {image ? (
              <img className="promo-image" src={image} alt="" onError={() => setBroken(ids => [...ids, promo.id])} />
            ) : (
              <Megaphone size={20} aria-hidden="true" />
            )}
            <div>
              <small>{tr('Πρόταση')}</small>
              <h3>{promo.title}</h3>
              <p>{promo.message}</p>
              {link && (
                <a className="promo-cta" href={link} target="_blank" rel="noopener noreferrer">
                  {promo.linkLabel || tr('Περισσότερα')} <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => hide(promo.id)}
              aria-label={tr('Απόκρυψη πρότασης')}
            >
              <X size={16} />
            </button>
          </article>
        );
      })}
    </div>
  );
}
