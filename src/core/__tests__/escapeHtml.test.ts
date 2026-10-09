import {describe, expect, it} from 'vitest';
import {escapeHtml} from '../escapeHtml';

describe('escapeHtml', () => {
  it('escapes the characters that matter in content and quoted attributes', () => {
    expect(escapeHtml(`<a href="x" title='y'>Tom & Jerry</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;',
    );
  });

  it('writes numbers as text and nothing for null or undefined', () => {
    expect(escapeHtml(0)).toBe('0');
    expect(escapeHtml(-3.5)).toBe('-3.5');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('leaves Greek and plain text as it is', () => {
    expect(escapeHtml('Αποστείρωση Set 12')).toBe('Αποστείρωση Set 12');
  });
});
