/** One person seen in the last minutes (platform_active_sessions). */
export type ActiveSession = {
  user_id: string;
  name: string;
  email: string;
  role: string | null;
  organization_id: string | null;
  organization_name: string | null;
  active: boolean;
  ip: string | null;
  ip_blocked: boolean;
  user_agent: string | null;
  first_seen: string;
  last_seen: string;
};

/** The browser and system of a user agent, short enough for a table cell («Chrome · Windows»). */
export function browserOf(agent?: string | null): string {
  if (!agent) return '—';
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /OPR\/|Opera/.test(agent)
      ? 'Opera'
      : /Firefox\//.test(agent)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(agent)
          ? 'Chrome'
          : /Safari\//.test(agent)
            ? 'Safari'
            : '';
  const system = /Windows/.test(agent)
    ? 'Windows'
    : /iPhone|iPad|iPod/.test(agent)
      ? 'iOS'
      : /Android/.test(agent)
        ? 'Android'
        : /Mac OS X/.test(agent)
          ? 'macOS'
          : /Linux/.test(agent)
            ? 'Linux'
            : '';
  return [browser, system].filter(Boolean).join(' · ') || agent.slice(0, 40);
}

/** «τώρα», «πριν 20 δευτ.», «πριν 3 λεπτά» for the last time a person was seen. */
export function sinceLabel(iso: string, now: number, L: (el: string, en: string) => string): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 20) return L('τώρα', 'now');
  if (seconds < 90) return L(`πριν ${seconds} δευτ.`, `${seconds} s ago`);
  const minutes = Math.round(seconds / 60);
  return L(`πριν ${minutes} λεπτά`, `${minutes} min ago`);
}
