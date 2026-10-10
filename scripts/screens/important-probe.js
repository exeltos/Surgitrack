// Run in a captured page (capture.mjs SCREENS_EVAL): for each !important declaration of the app's
// stylesheet whose rule matches something on the page, drop the importance on its own and compare
// what the browser computes for the matched elements (all properties) and their descendants (the
// inherited ones). Returns the declarations seen ("context|selector|property", the property as the browser
// serializes it, a shorthand where it can) and those that changed
// something. Rules for states a still page cannot show (:hover, :focus, …) are left out: never removed.
(() => {
  const STATE =
    /:(hover|focus|focus-visible|focus-within|active|visited|target|checked|indeterminate|placeholder-shown|autofill|disabled|enabled|invalid|valid|user-invalid|empty|open|popover-open|modal|fullscreen|read-only|read-write|default|required|optional)\b/;
  const PSEUDO_ELEMENT =
    /::?(before|after|placeholder|selection|marker|backdrop|first-line|first-letter|file-selector-button|-webkit-[a-z-]+|-moz-[a-z-]+)\b/;
  const INHERITED = [
    'color',
    'font-family',
    'font-size',
    'font-style',
    'font-weight',
    'line-height',
    'letter-spacing',
    'text-align',
    'text-transform',
    'white-space',
    'word-break',
    'overflow-wrap',
    'visibility',
    'cursor',
    'direction',
    'list-style-type',
  ];
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
        for (const d of declsOf(rule.style)) if (d.important) items.push({rule, prop: d.name, context});
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
  const fullStyle = (el, pseudo) => {
    const cs = getComputedStyle(el, pseudo);
    let out = '';
    for (let i = 0; i < cs.length; i++) out += cs.getPropertyValue(cs[i]) + ';';
    return out;
  };
  const inheritedStyle = el => {
    const cs = getComputedStyle(el);
    return INHERITED.map(p => cs.getPropertyValue(p)).join(';');
  };
  const seen = [];
  const changed = [];
  for (const {rule, prop, context} of items) {
    const selector = rule.selectorText;
    if (STATE.test(selector)) continue;
    const pseudo = PSEUDO_ELEMENT.exec(selector)?.[0];
    // Each part of a selector list on its own; a pseudo-element's rule is checked on its element.
    const parts = selector.split(',').map(part => part.replace(PSEUDO_ELEMENT, '').trim() || '*');
    let elements;
    try {
      elements = [...new Set(parts.flatMap(part => [...document.querySelectorAll(part)]))].slice(0, 60);
    } catch {
      continue;
    }
    if (!elements.length) continue;
    const key = `${context.join(' | ')}|${normSelector(selector)}|${prop}`;
    seen.push(key);
    const descendants = elements.flatMap(el => [...el.querySelectorAll('*')]).slice(0, 300);
    const snapshot = () =>
      elements
        .map(el => fullStyle(el, pseudo ? `::${pseudo.replace(/^::?/, '')}` : undefined) + fullStyle(el))
        .join('|') +
      '#' +
      descendants.map(inheritedStyle).join('|');
    const saved = rule.style.cssText;
    const before = snapshot();
    rule.style.cssText = withoutImportance(rule.style, new Set([prop]));
    const after = snapshot();
    rule.style.cssText = saved;
    if (before !== after) changed.push(key);
  }
  return {seen, changed};
})();
