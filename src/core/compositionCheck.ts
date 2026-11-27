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

type Requirement = {code: string; name: string; quantity: number};
type Added = {code?: string; name: string};

const words = (name: string) => new Set(nameKey(name).split(/\s+/).filter(Boolean));
/** How alike two names are: the words they share (a KOCHER for a KOCHER before a KOCHER for a MOSQUITO). */
const likeness = (a: string, b: string) => {
  const other = words(b);
  return [...words(a)].filter(word => other.has(word)).length;
};

/**
 * A Set's template after instruments are put into it by hand, so that the composition sheet says what the Set's
 * count says. An instrument its template asks for fills its own line. One the template does not ask for (or more
 * of a kind than it asks for) takes the place of one that is missing, the most alike by name, which is how a
 * replacement with another code is made: the template then asks for the new one. With nothing missing, the
 * template grows by it, as the Set's expected count does. Instruments taken out leave their line as it is: the
 * Set still needs them. A Set with no template keeps none.
 */
export function templateWithAdded(
  template: readonly Requirement[] | undefined,
  members: readonly Added[],
  added: readonly Added[],
): Requirement[] | undefined {
  if (!template?.length || !added.length) return template ? [...template] : template;
  const lines = template.map(line => ({...line}));
  const present = new Map<string, number>();
  for (const member of members) {
    const key = keyOf(member.code, member.name);
    present.set(key, (present.get(key) || 0) + 1);
  }
  const has = (key: string) => present.get(key) || 0;
  for (const tool of added) {
    const key = keyOf(tool.code, tool.name);
    const own = lines.findIndex(line => keyOf(line.code, line.name) === key);
    present.set(key, has(key) + 1);
    if (own >= 0 && has(key) <= lines[own].quantity) continue;
    let missing = -1;
    lines.forEach((line, index) => {
      const lineKey = keyOf(line.code, line.name);
      if (lineKey === key || has(lineKey) >= line.quantity) return;
      if (missing < 0 || likeness(line.name, tool.name) > likeness(lines[missing].name, tool.name)) missing = index;
    });
    const fresh = {code: tool.code || '', name: tool.name, quantity: 1};
    if (missing >= 0 && own < 0 && lines[missing].quantity === 1) {
      // The replacement takes the missing one's place in the list.
      lines[missing] = fresh;
      continue;
    }
    if (missing >= 0) {
      lines[missing].quantity -= 1;
      if (!lines[missing].quantity) lines.splice(missing, 1);
    }
    const at = lines.findIndex(line => keyOf(line.code, line.name) === key);
    if (at >= 0) lines[at].quantity += 1;
    else lines.push(fresh);
  }
  return lines;
}
