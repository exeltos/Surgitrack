/** The usual programs of a steam sterilizer, and of a low-temperature (hydrogen peroxide plasma) one. */
export const STEAM_PROGRAMS = ['134°C · 5 min', '121°C · 18 min'];
export const PLASMA_PROGRAMS = ['60°C'];

/** A plasma sterilizer by its name (STERRAD, «Πλάσμα»…), for its usual programs. */
export const isPlasma = (name: string) => /πλ[αά]σμα|plasma|sterr?ad|h2o2/i.test(name);

/** The programs a sterilizer offers: its own, or the usual ones for its kind. */
export const programsOf = (sterilizer?: {el: string; programs?: string[]}) => {
  const own = (sterilizer?.programs || []).map(p => p.trim()).filter(Boolean);
  if (own.length) return own;
  return sterilizer && isPlasma(sterilizer.el) ? PLASMA_PROGRAMS : STEAM_PROGRAMS;
};
