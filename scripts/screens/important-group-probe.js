// Second pass of the !important audit (see scripts/css-important.mjs). Each candidate passed the first
// pass on its own; here they are dropped all together, since two !important that cover each other can
// each look unneeded alone. Whatever then changes on the page (any computed property of any element),
// the candidates that could have caused it keep their !important, and the rest is tried again, until
// the page is as it was. Returns the candidates kept. `__CANDIDATES__` is replaced by the keys to try.
(() => {
  const CANDIDATES = new Set(__CANDIDATES__);
  const PSEUDO_ELEMENT =
    /::?(before|after|placeholder|selection|marker|backdrop|first-line|first-letter|file-selector-button|-webkit-[a-z-]+|-moz-[a-z-]+)\b/;
  // A rule's declarations as the browser serializes them (shorthands kept, e.g. `background: var(--x)`).
  // Changing and restoring a rule goes through cssText: a longhand of a shorthand that uses var() reads
  // as empty on its own, so setProperty could not put it back.
  const declsOf = style => {
    const out = [];
    let depth = 0;
    let quote = null;
    let cur = '';
    for (const ch of style.cssText) {
      if (quote) {
        cur += ch;
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ';' && depth === 0) {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.map(text => {
      const at = text.indexOf(':');
      const value = text.slice(at + 1).trim();
      const important = /!\s*important$/i.test(value);
      return {name: text.slice(0, at).trim(), value: value.replace(/\s*!\s*important$/i, ''), important};
    });
  };
  /** The rule's text with the !important of these declarations dropped. */
  const withoutImportance = (style, names) =>
    declsOf(style)
      .map(d => `${d.name}: ${d.value}${d.important && !names.has(d.name) ? ' !important' : ''}`)
      .join('; ');
  const space = s => s.replace(/\s+/g, ' ').trim();
  const normSelector = s => space(s).replace(/\s*([>+~,])\s*/g, '$1');
  const normContext = s => s.replace(/\s+/g, '');
  const items = [];
  const walk = (rules, context) => {
    for (const rule of rules) {
      if (rule instanceof CSSMediaRule) walk(rule.cssRules, [...context, `@media ${normContext(rule.conditionText)}`]);
      else if (rule instanceof CSSSupportsRule)
        walk(rule.cssRules, [...context, `@supports ${normContext(rule.conditionText)}`]);
      else if (rule instanceof CSSStyleRule) {
        for (const d of declsOf(rule.style)) {
          if (!d.important) continue;
          const key = `${context.join(' | ')}|${normSelector(rule.selectorText)}|${d.name}`;
          if (CANDIDATES.has(key)) items.push({rule, prop: d.name, key});
        }
      }
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      walk(sheet.cssRules, []);
    } catch {
      // Another origin's sheet: not ours.
    }
  }
  const elements = [...document.querySelectorAll('*')];
  const snapshot = () =>
    elements.map(el => {
      const out = {};
      for (const pseudo of [undefined, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        // A pseudo-element only when there is one.
        if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
        const values = {};
        for (let i = 0; i < cs.length; i++) values[cs[i]] = cs.getPropertyValue(cs[i]);
        out[pseudo || ''] = values;
      }
      return out;
    });
  const matches = (item, el) => {
    try {
      return item.rule.selectorText.split(',').some(part => el.matches(part.replace(PSEUDO_ELEMENT, '').trim() || '*'));
    } catch {
      return true;
    }
  };
  const base = snapshot();
  const kept = new Set();
  let active = items;
  let clean = false;
  for (let round = 0; round < 12 && active.length; round++) {
    // Drop them all, rule by rule, and put every rule back as it was.
    const byRule = new Map();
    active.forEach(i => byRule.set(i.rule, (byRule.get(i.rule) || new Set()).add(i.prop)));
    const saved = new Map([...byRule.keys()].map(rule => [rule, rule.style.cssText]));
    byRule.forEach((names, rule) => (rule.style.cssText = withoutImportance(rule.style, names)));
    const now = snapshot();
    saved.forEach((text, rule) => (rule.style.cssText = text));
    // What differs, element by element.
    const diffs = [];
    now.forEach((styles, e) => {
      for (const p of new Set([...Object.keys(styles), ...Object.keys(base[e])])) {
        const a = styles[p] || {};
        const b = base[e][p] || {};
        const props = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => a[k] !== b[k]);
        if (props.length) diffs.push({el: elements[e], props: new Set(props)});
      }
    });
    if (!diffs.length) {
      clean = true;
      break;
    }
    // The candidates that set a differing property on that element or an ancestor (inherited values)…
    let culprits = active.filter(i =>
      diffs.some(d => {
        if (![...d.props].some(p => p === i.prop || p.startsWith(`${i.prop}-`))) return false;
        for (let el = d.el; el; el = el.parentElement) if (matches(i, el)) return true;
        return false;
      }),
    );
    // …or, for a value the browser derived (a width from a padding), any candidate on those elements.
    if (!culprits.length)
      culprits = active.filter(i =>
        diffs.some(d => {
          for (let el = d.el; el; el = el.parentElement) if (matches(i, el)) return true;
          return false;
        }),
      );
    if (!culprits.length) culprits = active;
    culprits.forEach(i => kept.add(i.key));
    active = active.filter(i => !culprits.includes(i));
  }
  // Not settled within the rounds: whatever is left keeps its !important too.
  if (!clean) active.forEach(i => kept.add(i.key));
  return {kept: [...kept], tried: items.length, candidates: CANDIDATES.size};
})();
