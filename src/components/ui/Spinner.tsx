import {tr} from '../../i18n';

/**
 * Loading indicator; `fullScreen` centers it on the whole page (e.g. while the workspace loads).
 * `detail` is a visible line under it (e.g. how far a long load has come); it changes often, so screen
 * readers keep to the label.
 */
export default function Spinner({
  fullScreen = false,
  label,
  detail,
}: {
  fullScreen?: boolean;
  label?: string;
  detail?: string;
}) {
  const text = label || tr('Φόρτωση…');
  return (
    <div className={fullScreen ? 'app-spinner-wrap full' : 'app-spinner-wrap'} role="status" aria-live="polite">
      <span className="app-spinner" aria-hidden="true" />
      <span className="visually-hidden">{text}</span>
      {detail && (
        <span className="app-spinner-detail" aria-hidden="true">
          {detail}
        </span>
      )}
    </div>
  );
}
