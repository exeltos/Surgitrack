import {tr} from '../../i18n';

/** Loading indicator; `fullScreen` centers it on the whole page (e.g. while the workspace loads). */
export default function Spinner({fullScreen = false, label}: {fullScreen?: boolean; label?: string}) {
  const text = label || tr('Φόρτωση…');
  return (
    <div className={fullScreen ? 'app-spinner-wrap full' : 'app-spinner-wrap'} role="status" aria-live="polite">
      <span className="app-spinner" aria-hidden="true" />
      <span className="visually-hidden">{text}</span>
    </div>
  );
}
