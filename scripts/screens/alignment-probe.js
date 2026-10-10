// Run in a captured page (capture.mjs SCREENS_EVAL): column titles that do not line up with their column.
// For every table (thead th against the first body row's cells) and every grid list whose head is a
// `*-head` element with one child per column (against the first row with as many children), returns the
// columns whose title lines up with the content of its column neither on the left nor on the right
// (more than 6 px off on both sides).
(() => {
  const visible = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  // The box of what a cell shows: its visible children (pills, buttons, links), else its text.
  const content = cell => {
    const kids = [...cell.children].filter(visible);
    if (kids.length) {
      const boxes = kids.map(kid => kid.getBoundingClientRect());
      return {left: Math.min(...boxes.map(b => b.left)), right: Math.max(...boxes.map(b => b.right))};
    }
    const range = document.createRange();
    range.selectNodeContents(cell);
    const text = range.getBoundingClientRect();
    return text.width ? {left: text.left, right: text.right} : null;
  };
  const label = el => (el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')}`);
  const found = [];
  const compare = (where, heads, cells) => {
    const off = [];
    heads.forEach((head, i) => {
      const cell = cells[i];
      // A title only screen readers get (visually hidden) has nothing to line up.
      const shown = [...head.childNodes].some(n =>
        n.nodeType === 3 ? n.textContent.trim() : !n.classList?.contains('visually-hidden') && n.textContent.trim(),
      );
      if (!cell || !visible(head) || !visible(cell) || !shown) return;
      const a = content(head);
      const b = content(cell);
      if (!a || !b) return;
      const left = b.left - a.left;
      const right = b.right - a.right;
      if (Math.abs(left) > 6 && Math.abs(right) > 6)
        off.push(
          `${head.textContent.trim().slice(0, 24)}: ${Math.round(Math.abs(left) < Math.abs(right) ? left : right)}px`,
        );
    });
    if (off.length) found.push(`${where} → ${off.join(', ')}`);
  };
  for (const table of document.querySelectorAll('table')) {
    if (!visible(table)) continue;
    const heads = [...table.querySelectorAll('thead tr:last-child > th')];
    const row = [...table.querySelectorAll('tbody > tr')].find(r => r.children.length === heads.length && visible(r));
    if (heads.length && row) compare(label(table), heads, [...row.children]);
  }
  for (const head of document.querySelectorAll('[class*="-head"]')) {
    if (head.tagName === 'THEAD' || !visible(head) || head.children.length < 3) continue;
    if (getComputedStyle(head).display !== 'grid') continue;
    const n = head.children.length;
    const row = [...head.parentElement.querySelectorAll('*')].find(
      el =>
        el !== head &&
        !head.contains(el) &&
        el.children.length === n &&
        visible(el) &&
        getComputedStyle(el).display === 'grid',
    );
    if (row) compare(label(head), [...head.children], [...row.children]);
  }
  return found;
})();
