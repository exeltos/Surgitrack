import {describe, expect, it} from 'vitest';
import {usernameSheetsHtml, usernameTable} from '../usernameLists';

const rows = [
  {department: 'ΜΕΘ', name: 'ΝΙΚΟΣ ΠΑΠΑΔΟΠΟΥΛΟΣ', userCode: 'NP1000'},
  {department: 'ΑΠΟΣΤΕΙΡΩΣΗ', name: 'ΜΑΡΙΑ ΙΩΑΝΝΟΥ', userCode: 'MI2000'},
  {department: 'ΜΕΘ', name: 'ΑΝΝΑ ΛΑΜΠΡΟΥ', userCode: 'AL3000'},
];

describe('the usernames by department', () => {
  it('lists department, full name and username, by department and then name, and nothing else', () => {
    const table = usernameTable(rows, true);
    expect(table.headers).toEqual(['Τμήμα', 'Ονοματεπώνυμο', 'Όνομα χρήστη']);
    expect(table.rows).toEqual([
      ['ΑΠΟΣΤΕΙΡΩΣΗ', 'ΜΑΡΙΑ ΙΩΑΝΝΟΥ', 'MI2000'],
      ['ΜΕΘ', 'ΑΝΝΑ ΛΑΜΠΡΟΥ', 'AL3000'],
      ['ΜΕΘ', 'ΝΙΚΟΣ ΠΑΠΑΔΟΠΟΥΛΟΣ', 'NP1000'],
    ]);
  });

  it('prints one page per department with its people and how to sign in the first time, with no password', () => {
    const html = usernameSheetsHtml(rows, true, 'el', 'ΙΑΣΩ Θεσσαλίας');
    expect(html.match(/<section>/g)).toHaveLength(2);
    expect(html).toContain('<h1>ΑΠΟΣΤΕΙΡΩΣΗ</h1>');
    expect(html).toContain('NP1000');
    expect(html).toContain('ΙΑΣΩ Θεσσαλίας');
    expect(html).toContain('ως αρχικό κωδικό τον αριθμό του κινητού σας');
    expect(html).not.toMatch(/69\d{8}/);
  });

  it('escapes what it prints', () => {
    const html = usernameSheetsHtml([{department: '<b>X</b>', name: 'A & B', userCode: 'Z"1'}], false, 'en');
    expect(html).not.toContain('<b>X</b>');
    expect(html).toContain('A &amp; B');
  });
});
