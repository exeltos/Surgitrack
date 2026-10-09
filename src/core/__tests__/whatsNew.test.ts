import {describe, expect, it} from 'vitest';
import {APP_VERSION} from '../../config/appMeta';
import {notesFor, olderVersion, releases} from '../whatsNew';
import {permissionKeys} from '../permissions';

describe('what is new', () => {
  it('compares versions by number, not by text', () => {
    expect(olderVersion('0.9.1', '0.30.0')).toBe(true);
    expect(olderVersion('0.29.6', '0.30.0')).toBe(true);
    expect(olderVersion('0.30.0', '0.30.0')).toBe(false);
    expect(olderVersion('0.30.1', '0.30.0')).toBe(false);
    expect(olderVersion('1', '0.30.0')).toBe(false);
  });

  it('has notes for the current version, newest release first', () => {
    expect(releases[0].version).toBe(APP_VERSION);
    for (let i = 1; i < releases.length; i += 1)
      expect(olderVersion(releases[i].version, releases[i - 1].version)).toBe(true);
  });

  it('shows each person only what they can use', () => {
    const release = releases[0];
    const department = notesFor(release, p =>
      ['department.workspace', 'issue.create', 'asset.detail.view'].includes(p),
    );
    expect(department.some(n => n.permission === 'studio.manage')).toBe(false);
    expect(department.some(n => n.permission === 'issue.create')).toBe(true);
    expect(department.some(n => !n.permission)).toBe(true);
    expect(notesFor(release, () => true)).toHaveLength(release.notes.length);
  });

  it('names only real permissions and has both languages', () => {
    for (const note of releases.flatMap(r => r.notes)) {
      if (note.permission) expect(permissionKeys).toContain(note.permission);
      expect(note.el.trim()).not.toBe('');
      expect(note.en.trim()).not.toBe('');
    }
  });
});
