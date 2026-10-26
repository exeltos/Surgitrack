/**
 * A movement's time as a number, for sorting newest first. Movement times are Greek-locale strings
 * ("14/08/2026 09:28" or "14/8/26, 9:28 π.μ."); anything unparseable is 0.
 */
export const movementStamp = (at: string) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?:\s*(π\.?μ\.?|μ\.?μ\.?|am|pm))?/i.exec(at.trim());
  if (!m) return 0;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  let hour = Number(m[4]) % 12;
  const suffix = (m[6] || '').toLowerCase();
  if (!suffix) hour = Number(m[4]);
  else if (suffix.startsWith('μ') || suffix === 'pm') hour += 12;
  return new Date(year, Number(m[2]) - 1, Number(m[1]), hour, Number(m[5])).getTime();
};
