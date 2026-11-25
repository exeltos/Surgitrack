/** The usual programs of a steam sterilizer, and of a low-temperature (hydrogen peroxide plasma) one. */
export const STEAM_PROGRAMS = ['134°C · 5 min', '121°C · 18 min'];
export const PLASMA_PROGRAMS = ['60°C'];

/** A plasma sterilizer by its name (STERRAD, «Πλάσμα»…), for its usual programs. */
export const isPlasma = (name: string) => /πλ[αά]σμα|plasma|sterr?ad|h2o2/i.test(name);

/**
 * The programs a sterilizer offers: its own, or the usual ones for its kind. A sterilizer whose cycles end by hand
 * («MANUAL») offers them without their whole-cycle length, so no load started on it ends by itself.
 */
export const programsOf = (sterilizer?: {el: string; programs?: string[]; cycleEnd?: 'AUTO' | 'MANUAL'}) => {
  const own = (sterilizer?.programs || []).map(p => p.trim()).filter(Boolean);
  const offered = own.length ? own : sterilizer && isPlasma(sterilizer.el) ? PLASMA_PROGRAMS : STEAM_PROGRAMS;
  return sterilizer?.cycleEnd === 'MANUAL' ? offered.map(programBase) : offered;
};

// A program may say how long the whole cycle lasts, as «134°C · 5 min · σύνολο 45 min»: then its end is known and
// the cycle ends by itself. «5 min» alone is only the exposure (the heating and the drying come on top).
const TOTAL = /\s*·?\s*(?:σύνολο|συνολικά|total)\s*(\d{1,3})\s*(?:min|λεπτά|λ\.?|['′’])?\s*$/i;

/** The whole cycle's minutes the program says (undefined when it does not). */
export const programTotalMinutes = (program: string | undefined) => {
  const m = TOTAL.exec(program || '');
  const minutes = m ? Number(m[1]) : 0;
  return minutes > 0 ? minutes : undefined;
};

/** The program without its whole-cycle length: «134°C · 5 min». */
export const programBase = (program: string) => program.replace(TOTAL, '').trim();

/** The program with its whole-cycle length (none: the program alone). */
export const withTotalMinutes = (program: string, minutes: number | undefined) => {
  const base = programBase(program);
  if (!minutes || minutes <= 0) return base;
  return [base, `σύνολο ${Math.round(minutes)} min`].filter(Boolean).join(' · ');
};

/** A program in its parts, as the settings edit it: a name (optional), °C, exposure and whole-cycle minutes. */
export type ProgramFields = {name: string; temperature: string; exposure: string; total: string};

/** A program written as text («Prion · 134°C · 18 min · σύνολο 60 min»), in its parts. */
export function programFields(program: string): ProgramFields {
  let rest = programBase(program);
  const take = (re: RegExp) => {
    const m = re.exec(rest);
    if (!m) return '';
    rest = rest.replace(m[0], ' ');
    return m[1];
  };
  const temperature = take(/(\d{2,3})\s*°?\s*C\b/i);
  // Minutes as «5 min», «5 λεπτά» or with a prime («5′», «5'»).
  const exposure = take(/(\d{1,3})\s*(?:min|λεπτά|λεπτ|['′’])/i);
  const name = rest
    .split('·')
    .map(part => part.trim())
    .filter(Boolean)
    .join(' · ');
  return {name, temperature, exposure, total: String(programTotalMinutes(program) ?? '')};
}

/** The program as text, from its parts (the way the records keep it): «134°C · 5 min · σύνολο 45 min». */
export function programFromFields(fields: ProgramFields) {
  const num = (value: string) => Number(value.replace(/\D/g, '')) || 0;
  const temperature = num(fields.temperature);
  const exposure = num(fields.exposure);
  const base = [fields.name.trim(), temperature ? `${temperature}°C` : '', exposure ? `${exposure} min` : '']
    .filter(Boolean)
    .join(' · ');
  return withTotalMinutes(base, num(fields.total) || undefined);
}
