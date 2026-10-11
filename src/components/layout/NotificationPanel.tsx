import {useNavigate} from 'react-router-dom';
import {CalendarClock, Gauge, PackageCheck, TriangleAlert, UserPlus, X} from 'lucide-react';
import type {Issue, SetAsset, Tool} from '../../types/domain';
import type {LifecycleAlert} from '../../store/types';
import type {UserRole} from '../../store/types';
import {formatExpiry, type ExpiryEntry} from '../../core/sterileExpiry';
import {trData} from '../../i18n';

const expiryText = (e: ExpiryEntry, lang: string) =>
  e.state === 'EXPIRED'
    ? lang === 'el'
      ? `Η αποστείρωση έληξε στις ${formatExpiry(e.sterileUntil)}`
      : `Sterility expired on ${formatExpiry(e.sterileUntil)}`
    : lang === 'el'
      ? `Η αποστείρωση λήγει στις ${formatExpiry(e.sterileUntil)} (${e.daysLeft} ημ.)`
      : `Sterility expires on ${formatExpiry(e.sterileUntil)} (${e.daysLeft} d)`;

/** What the top bar's bell counts, by kind. */
export type Notices = {
  departmentReady: Array<SetAsset | Tool>;
  departmentIssues: Issue[];
  departmentExpiry: ExpiryEntry[];
  departmentUsage: LifecycleAlert[];
  accessRequests: number;
  expiryNotices: ExpiryEntry[];
  outOfUseNotices: Tool[];
  openIssues: Issue[];
  lifecycleAlerts: LifecycleAlert[];
  openNotifications: number;
};

/** The bell's panel: a department's own items, or the hospital's issues, expiries, limits and requests. */
export default function NotificationPanel({
  role,
  lang,
  notices,
  onAcknowledgeOutOfUse,
  onClose,
}: {
  role: UserRole;
  lang: string;
  notices: Notices;
  onAcknowledgeOutOfUse: (toolId: string) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const {
    departmentReady,
    departmentIssues,
    departmentExpiry,
    departmentUsage,
    accessRequests,
    expiryNotices,
    outOfUseNotices,
    openIssues,
    lifecycleAlerts,
    openNotifications,
  } = notices;
  return (
    <div className="notification-popover">
      <header>
        <strong>{lang === 'el' ? 'Ειδοποιήσεις' : 'Notifications'}</strong>
        <button onClick={() => onClose()}>
          <X size={15} />
        </button>
      </header>
      {role === 'DEPARTMENT' ? (
        <div className="notification-list">
          {departmentReady.map(a => (
            <button
              key={`ready-${a.id}`}
              className="notification-item ready"
              onClick={() => {
                onClose();
                navigate(a.barcode.startsWith('S') ? `/sets/${a.id}` : `/tools/${a.id}`);
              }}
            >
              <PackageCheck size={17} />
              <span>
                <strong>
                  {a.barcode} · {a.name}
                </strong>
                <small>
                  {lang === 'el' ? 'Έτοιμο για παραλαβή από την Αποστείρωση' : 'Ready for pickup from Sterilization'}
                </small>
              </span>
            </button>
          ))}
          {departmentIssues.slice(0, 5).map(i => (
            <button
              key={i.id}
              className="notification-item"
              onClick={() => {
                onClose();
                navigate('/issues');
              }}
            >
              <TriangleAlert size={17} />
              <span>
                <strong>{i.asset}</strong>
                <small>{trData(i.type)}</small>
              </span>
            </button>
          ))}
          {departmentExpiry.slice(0, 5).map(e => (
            <button
              key={`exp-${e.kind}-${e.id}`}
              className={`notification-item expiry ${e.state.toLowerCase()}`}
              onClick={() => {
                onClose();
                navigate(e.kind === 'SET' ? `/sets/${e.id}` : `/tools/${e.id}`);
              }}
            >
              <CalendarClock size={17} />
              <span>
                <strong>
                  {e.barcode} · {e.name}
                </strong>
                <small>{expiryText(e, lang)}</small>
              </span>
            </button>
          ))}
          {departmentUsage.slice(0, 5).map(a => (
            <button
              key={a.id}
              className="notification-item"
              onClick={() => {
                onClose();
                navigate('/department');
              }}
            >
              <Gauge size={17} />
              <span>
                <strong>
                  {a.barcode} · {a.name}
                </strong>
                <small>{lang === 'el' ? `${a.remaining} χρήσεις απομένουν` : `${a.remaining} uses remaining`}</small>
              </span>
            </button>
          ))}
          {openNotifications === 0 && (
            <div className="notification-empty">
              {lang === 'el' ? 'Δεν υπάρχουν νέες ειδοποιήσεις.' : 'No new notifications.'}
            </div>
          )}
        </div>
      ) : (
        <>
          {accessRequests > 0 && (
            <div className="notification-list">
              <button
                className="notification-item ready"
                onClick={() => {
                  onClose();
                  navigate('/hospital');
                }}
              >
                <UserPlus size={17} />
                <span>
                  <strong>
                    {lang === 'el'
                      ? `${accessRequests} ${accessRequests === 1 ? 'αίτημα' : 'αιτήματα'} πρόσβασης`
                      : `${accessRequests} access ${accessRequests === 1 ? 'request' : 'requests'}`}
                  </strong>
                  <small>{lang === 'el' ? 'Αναμένουν την έγκρισή σας' : 'Waiting for your approval'}</small>
                </span>
              </button>
            </div>
          )}
          {expiryNotices.length > 0 && (
            <div className="notification-list">
              <span className="notification-group">
                {lang === 'el' ? 'Λήξη αποστείρωσης' : 'Sterile expiry'} · {expiryNotices.length}
              </span>
              {expiryNotices.slice(0, 6).map(e => (
                <button
                  key={`exp-${e.kind}-${e.id}`}
                  className={`notification-item expiry ${e.state.toLowerCase()}`}
                  onClick={() => {
                    onClose();
                    navigate('/expiry');
                  }}
                >
                  <CalendarClock size={17} />
                  <span>
                    <strong>
                      {e.barcode} · {e.name}
                    </strong>
                    <small>{expiryText(e, lang)}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
          {outOfUseNotices.length > 0 && (
            <div className="notification-list">
              {outOfUseNotices.slice(0, 8).map(t => (
                <div key={`out-${t.id}`} className="notification-item out-of-use">
                  <Gauge size={17} />
                  <span>
                    <strong>
                      {t.barcode} · {t.name}
                    </strong>
                    <small>
                      {lang === 'el'
                        ? `Εκτός χρήσης · ${trData(t.retiredReason || '')} · ${t.retiredAt || ''}`
                        : `Out of use · ${trData(t.retiredReason || '')} · ${t.retiredAt || ''}`}
                    </small>
                  </span>
                  <button type="button" onClick={() => onAcknowledgeOutOfUse(t.id)}>
                    {lang === 'el' ? 'Ενημερώθηκα' : 'Got it'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {openIssues.length > 0 && (
            <div className="notification-list">
              <span className="notification-group">
                {lang === 'el' ? 'Ανοιχτές εκκρεμότητες' : 'Open issues'} · {openIssues.length}
              </span>
              {openIssues.slice(0, 6).map(i => (
                <button
                  key={i.id}
                  className="notification-item"
                  onClick={() => {
                    onClose();
                    navigate('/issues');
                  }}
                >
                  <TriangleAlert size={17} />
                  <span>
                    <strong>{i.asset}</strong>
                    <small>
                      {trData(i.type)} · {trData(i.department)} · {i.created}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
          {lifecycleAlerts.length > 0 && (
            <div className="notification-list">
              <span className="notification-group">
                {lang === 'el' ? 'Λίγες χρήσεις απομένουν' : 'Few uses left'} · {lifecycleAlerts.length}
              </span>
              {lifecycleAlerts.slice(0, 6).map(a => (
                <button
                  key={a.id}
                  className="notification-item"
                  onClick={() => {
                    onClose();
                    navigate(a.assetKind === 'SET' ? `/sets/${a.assetId}` : `/tools/${a.assetId}`);
                  }}
                >
                  <Gauge size={17} />
                  <span>
                    <strong>
                      {a.barcode} · {a.name}
                    </strong>
                    <small>
                      {lang === 'el'
                        ? `${a.remaining} από ${a.maxUses} χρήσεις απομένουν`
                        : `${a.remaining} of ${a.maxUses} uses left`}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
          {openNotifications === 0 ? (
            <div className="notification-empty">
              {lang === 'el' ? 'Δεν υπάρχουν νέες ειδοποιήσεις.' : 'No new notifications.'}
            </div>
          ) : (
            openIssues.length > 6 && (
              <button
                className="notification-more"
                onClick={() => {
                  onClose();
                  navigate('/issues');
                }}
              >
                {lang === 'el' ? `Όλες οι εκκρεμότητες (${openIssues.length})` : `All issues (${openIssues.length})`}
              </button>
            )
          )}
        </>
      )}
    </div>
  );
}
