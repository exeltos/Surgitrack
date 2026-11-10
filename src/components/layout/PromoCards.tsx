import {useEffect, useState} from 'react';
import {ExternalLink, FileText, Maximize2, Megaphone, X} from 'lucide-react';
import {getRuntimeDataMode} from '../../config/dataMode';
import {loadActiveNotices, safeLink, type PlatformNotice} from '../../data/cloud/platformNotices';
import {tr} from '../../i18n';
import PromoPopup from './PromoPopup';

const HIDDEN = 'surgitrack-promos-hidden';
/** The promotions already shown in front of the screen on this device. */
const SEEN = 'surgitrack-promos-seen';
const REFRESH_MS = 10 * 60_000;

const readList = (key: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as string[];
  } catch {
    return [];
  }
};
const writeList = (key: string, list: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Private mode: remembered until the page reloads.
  }
};

/**
 * The platform owner's promotions (Studio → Ειδοποιήσεις) as cards at the top of the hospital administrator's Overview:
 * a title, the text and a link that opens in a new tab. The database shows an administrator only the promotions for
 * their hospital; each can be hidden, and stays hidden on this device.
 */
export default function PromoCards() {
  const [promos, setPromos] = useState<PlatformNotice[]>([]);
  const [hidden, setHidden] = useState<string[]>(() => readList(HIDDEN));
  const [seen, setSeen] = useState<string[]>(() => readList(SEEN));
  const [opened, setOpened] = useState('');
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
    writeList(HIDDEN, next);
  };
  // A new promotion opens once in front of the screen; closed, it stays as a card on the Overview.
  const front = shown.find(promo => promo.id === opened) || shown.find(promo => !seen.includes(promo.id));
  const closeFront = () => {
    setOpened('');
    if (!front || seen.includes(front.id)) return;
    const next = [...seen, front.id];
    setSeen(next);
    writeList(SEEN, next);
  };
  return (
    <div className="promo-cards">
      {front && <PromoPopup promo={front} onClose={closeFront} />}
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
              {safeLink(promo.attachmentUrl) && (
                <a
                  className="promo-file"
                  href={safeLink(promo.attachmentUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText size={15} aria-hidden="true" /> {promo.attachmentName || 'PDF'}
                </a>
              )}
              <button type="button" className="promo-open" onClick={() => setOpened(promo.id)}>
                <Maximize2 size={14} aria-hidden="true" /> {tr('Προβολή')}
              </button>
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
