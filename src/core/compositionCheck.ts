import {nameKey} from './nameCheck';

type TemplateLine = {code: string; name: string; quantity: number};
type Member = {barcode: string; code?: string; name: string; manufacturer?: string};

/** One row of a Set's composition sheet: what it should hold, what it holds, and what is wrong. */
export type CompositionLine = {
  name: string;
  code: string;
  manufacturer: string;
  /** From the template; undefined for instruments the template does not list (or no template). */
  expected?: number;
  present: number;
  missing: number;
  /** Open issue types on these instruments (Βλάβη, Φθορά…), each once. */
  problems: string[];
};

const keyOf = (code: string | undefined, name: string) => {
  const c = (code || '').trim().toUpperCase();
  return c ? `C:${c}` : `N:${nameKey(name)}`;
};

/**
 * The composition sheet's rows. With a template, each template line takes the Set's instruments with
 * its code (or, with no code, its name) and shows how many are missing; instruments left over are
 * listed after it. Without a template the instruments are grouped by name, code and manufacturer.
 * `problems` gives the open issue types per instrument barcode.
 */
export function compositionLines(
  template: readonly TemplateLine[] | undefined,
  tools: readonly Member[],
  problems: ReadonlyMap<string, string[]> = new Map(),
): CompositionLine[] {
  const pool = new Map<string, Member[]>();
  for (const tool of tools) {
    const key = keyOf(tool.code, tool.name);
    pool.set(key, [...(pool.get(key) || []), tool]);
  }
  const problemsOf = (members: Member[]) => [...new Set(members.flatMap(m => problems.get(m.barcode) || []))];
  const lines: CompositionLine[] = [];
  for (const line of template || []) {
    const key = keyOf(line.code, line.name);
    const available = pool.get(key) || [];
    const taken = available.slice(0, Math.max(0, line.quantity));
    pool.set(key, available.slice(taken.length));
    lines.push({
      name: line.name,
      code: line.code || '—',
      manufacturer: taken.find(t => t.manufacturer)?.manufacturer || '—',
      expected: line.quantity,
      present: taken.length,
      missing: Math.max(0, line.quantity - taken.length),
      problems: problemsOf(taken),
    });
  }
  const groups = new Map<string, Member[]>();
  for (const member of [...pool.values()].flat()) {
    const key = `${member.name}__${member.code || ''}__${member.manufacturer || ''}`;
    groups.set(key, [...(groups.get(key) || []), member]);
  }
  const rest = [...groups.values()]
    .map(members => ({
      name: members[0].name,
      code: members[0].code || '—',
      manufacturer: members[0].manufacturer || '—',
      present: members.length,
      missing: 0,
      problems: problemsOf(members),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'el') || a.code.localeCompare(b.code));
  return [...lines, ...rest];
}
