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
  const lineKey = (line: Requirement) => keyOf(line.code, line.name);
  // What the template asks for and what the Set holds, per code (lines sharing a code are added up).
  const required = new Map<string, number>();
  for (const line of lines) required.set(lineKey(line), (required.get(lineKey(line)) || 0) + line.quantity);
  const present = new Map<string, number>();
  const count = (map: Map<string, number>, key: string) => map.get(key) || 0;
  for (const member of members) {
    const key = keyOf(member.code, member.name);
    present.set(key, count(present, key) + 1);
  }
  // First every incoming instrument the template asks for takes its own place, whatever the order they came in;
  // only those left over replace what is still missing.
  const surplus: Added[] = [];
  for (const tool of added) {
    const key = keyOf(tool.code, tool.name);
    if (count(present, key) < count(required, key)) present.set(key, count(present, key) + 1);
    else surplus.push(tool);
  }
  for (const tool of surplus) {
    const key = keyOf(tool.code, tool.name);
    let missing: string | undefined;
    let missingName = '';
    for (const line of lines) {
      const k = lineKey(line);
      if (k === key || count(present, k) >= count(required, k)) continue;
      if (missing === undefined || likeness(line.name, tool.name) > likeness(missingName, tool.name)) {
        missing = k;
        missingName = line.name;
      }
    }
    const fresh = {code: tool.code || '', name: tool.name, quantity: 1};
    present.set(key, count(present, key) + 1);
    required.set(key, count(required, key) + 1);
    if (missing !== undefined) {
      required.set(missing, count(required, missing) - 1);
      // The missing one's last line gives up one.
      let at = -1;
      lines.forEach((line, index) => {
        if (lineKey(line) === missing) at = index;
      });
      const own = lines.some(line => lineKey(line) === key);
      if (!own && lines[at].quantity === 1) {
        // The replacement takes the missing one's place in the list.
        lines[at] = fresh;
        continue;
      }
      lines[at].quantity -= 1;
      if (!lines[at].quantity) lines.splice(at, 1);
    }
    const own = lines.findIndex(line => lineKey(line) === key);
    if (own >= 0) lines[own].quantity += 1;
    else lines.push(fresh);
  }
  return lines;
}
