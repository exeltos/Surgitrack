/**
 * A new hospital's code, made from its name: the Latin initials of up to three of its words and
 * four random digits (ΙΑΣΩ Θεσσαλίας → IT-4821). The database keeps codes unique; on a clash the
 * caller asks for another.
 */
const GREEK = 'ΑΆΒΓΔΕΈΖΗΉΘΙΊΪΐΚΛΜΝΞΟΌΠΡΣΤΥΎΫΰΦΧΨΩΏ';
const LATIN = 'AABGDEEZIITIIIIKLMNXOOPRSTYYYYFXPOO';

const toLatin = (text: string) =>
  [...text.toUpperCase()].map(c => (GREEK.includes(c) ? LATIN[GREEK.indexOf(c)] : c)).join('');

export const organizationCode = (name: string, random = Math.random) => {
  const words = toLatin(name)
    .split(/[\s.\-·,/]+/)
    .map(word => word.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
  const initials = (
    words
      .map(word => word[0])
      .join('')
      .slice(0, 3) || 'HOSP'
  ).replace(/[^A-Z0-9]/g, '');
  return `${initials}-${String(Math.floor(random() * 10000)).padStart(4, '0')}`;
};
