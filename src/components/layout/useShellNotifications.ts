import {useEffect, useMemo, useState} from 'react';
import {useSurgi} from '../../store/SurgiStore';
import {expiryAlerts, sterileExpiryList} from '../../core/sterileExpiry';

/**
 * What the bell and the department's notices count, and the «ready for pickup» notice a department sees when a
 * Set or instrument of theirs becomes ready (split out of AppShell).
 */
export function useShellNotifications({
  lang,
  hospitalId,
  pendingAccess,
}: {
  lang: string;
  /** The hospital whose access requests the signed-in admin manages, if any. */
  hospitalId: string | undefined;
  pendingAccess: number;
}) {
  const {issues, lifecycleAlerts, sets, tools, retiredTools, currentUser, role} = useSurgi();
  const [departmentReadyToast, setDepartmentReadyToast] = useState<{id: string; text: string}>();
  const departmentAssets = [
    ...sets.filter(s => s.department === currentUser.department),
    ...tools.filter(t => t.department === currentUser.department && t.mode === 'STANDALONE'),
  ];
  const departmentReady = departmentAssets.filter(a => a.state === 'READY_FOR_PICKUP');
  const departmentIssues = issues.filter(i => i.status === 'OPEN' && i.department === currentUser.department);
  const departmentAssetIds = new Set(departmentAssets.map(asset => asset.id));
  const departmentUsage = lifecycleAlerts.filter(a => departmentAssetIds.has(a.assetId));
  // Sterile Sets and instruments in their last month (10 days for 2 months) or expired: worked out again only
  // when the Sets or instruments change (or the day does), not on every update of the screen.
  const day = new Date().toDateString();
  const expiryNotices = useMemo(() => expiryAlerts(sterileExpiryList(sets, tools, new Date(day))), [sets, tools, day]);
  const departmentExpiry = expiryNotices.filter(e => departmentAssetIds.has(e.id));
  const accessRequests = hospitalId ? pendingAccess : 0;
  const openIssues = issues.filter(i => i.status === 'OPEN');
  // Instruments that just ran out of lives: Sterilization must set them aside and confirm.
  const outOfUseNotices = role === 'DEPARTMENT' ? [] : retiredTools.filter(t => !t.retiredNoticeSeenAt);
  const openNotifications =
    role === 'DEPARTMENT'
      ? departmentReady.length + departmentIssues.length + departmentUsage.length + departmentExpiry.length
      : openIssues.length + lifecycleAlerts.length + accessRequests + outOfUseNotices.length + expiryNotices.length;
  const readyKey = departmentReady.map(asset => asset.id).join('|');
  useEffect(() => {
    if (role !== 'DEPARTMENT' || departmentReady.length === 0) {
      setDepartmentReadyToast(undefined);
      return;
    }
    const storageKey = `surgitrack-ready-seen:${currentUser.department}`;
    let seen = new Set<string>();
    try {
      seen = new Set(JSON.parse(window.sessionStorage.getItem(storageKey) || '[]') as string[]);
    } catch {
      seen = new Set<string>();
    }
    const newlyReady = departmentReady.filter(asset => !seen.has(asset.id));
    if (!newlyReady.length) return;

    const first = newlyReady[0];
    const extra = newlyReady.length - 1;
    const text =
      lang === 'el'
        ? `${first.barcode} · ${first.name} είναι έτοιμο για παραλαβή${extra > 0 ? ` (+${extra} ακόμη)` : ''}.`
        : `${first.barcode} · ${first.name} is ready for pickup${extra > 0 ? ` (+${extra} more)` : ''}.`;
    setDepartmentReadyToast({id: first.id, text});

    newlyReady.forEach(asset => seen.add(asset.id));
    window.sessionStorage.setItem(storageKey, JSON.stringify([...seen]));
    const timer = window.setTimeout(() => setDepartmentReadyToast(undefined), 5200);
    return () => window.clearTimeout(timer);
    // Keyed on the ids of the ready assets (readyKey), not on the array itself, which is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, currentUser.department, readyKey, lang]);
  return {
    departmentReady,
    departmentIssues,
    departmentUsage,
    departmentExpiry,
    expiryNotices,
    accessRequests,
    openIssues,
    outOfUseNotices,
    openNotifications,
    departmentReadyToast,
    setDepartmentReadyToast,
  };
}
