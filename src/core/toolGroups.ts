import type {Tool} from '../types/domain';

/**
 * Which instruments are "the same": by name, ignoring case, spaces and punctuation («FENESTRAT.BIPOLAR FORCEP 8 MM» and
 * «FENESTRAT. BIPOLAR FORCEP 8MM» are one kind). The code and the company are not part of it: in a hospital each piece
 * carries its own code (a lot and a serial, e.g. «K11260122 0184»), so grouping by code left nearly every piece alone
 * (980 groups for 2230 pieces, against 368 kinds).
 */
export const toolKind = (t: Pick<Tool, 'name'>) => t.name.toUpperCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** The instruments grouped by kind, in the order of the first piece of each. */
export const groupTools = (tools: Tool[]): Tool[][] => {
  const groups = new Map<string, Tool[]>();
  for (const t of tools) {
    const key = toolKind(t);
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }
  return [...groups.values()];
};

/** What a group's pieces have in common or not: their different values of a field, in order. */
export const distinctValues = (group: Tool[], pick: (t: Tool) => string | undefined) => [
  ...new Set(group.map(pick).filter((v): v is string => !!v)),
];
