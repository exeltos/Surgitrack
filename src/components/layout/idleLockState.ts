/** Whether the screen is locked, kept for the browser tab (a reload stays locked). */
export const LOCK_KEY = 'surgitrack-screen-locked';

/** Clears the lock (sign-out: the next user starts unlocked). */
export const clearIdleLock = () => sessionStorage.removeItem(LOCK_KEY);
