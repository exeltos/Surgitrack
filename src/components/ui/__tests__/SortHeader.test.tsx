import {describe, expect, it} from 'vitest';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SortTh} from '../SortHeader';
import {useTableSort} from '../useTableSort';

const data = [
  {name: 'Βήτα', n: 3},
  {name: 'Άλφα', n: 20},
  {name: 'Γάμμα', n: 1},
];

function Table() {
  const list = useTableSort(data, {name: r => r.name, n: r => r.n});
  return (
    <table>
      <thead>
        <tr>
          <SortTh label="Όνομα" sortKey="name" sort={list.sort} onSort={list.toggle} />
          <SortTh label="Πλήθος" sortKey="n" sort={list.sort} onSort={list.toggle} />
        </tr>
      </thead>
      <tbody>
        {list.rows.map(r => (
          <tr key={r.name}>
            <td>{r.name}</td>
            <td>{r.n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
const order = () =>
  within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map(row => row.firstChild?.textContent);

describe('a table sorted by its column titles', () => {
  it('goes ascending, descending, then back to the original order, and says so', async () => {
    render(<Table />);
    expect(order()).toEqual(['Βήτα', 'Άλφα', 'Γάμμα']);
    const name = screen.getByRole('button', {name: /^Όνομα/});
    await userEvent.click(name);
    expect(order()).toEqual(['Άλφα', 'Βήτα', 'Γάμμα']);
    expect(screen.getByRole('columnheader', {name: /^Όνομα/})).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(name);
    expect(order()).toEqual(['Γάμμα', 'Βήτα', 'Άλφα']);
    expect(screen.getByRole('columnheader', {name: /^Όνομα/})).toHaveAttribute('aria-sort', 'descending');
    await userEvent.click(name);
    expect(order()).toEqual(['Βήτα', 'Άλφα', 'Γάμμα']);
  });

  it('sorts numbers by size and moves to another column cleanly', async () => {
    render(<Table />);
    await userEvent.click(screen.getByRole('button', {name: /^Όνομα/}));
    await userEvent.click(screen.getByRole('button', {name: /^Πλήθος/}));
    expect(order()).toEqual(['Γάμμα', 'Βήτα', 'Άλφα']);
    expect(screen.getByRole('columnheader', {name: /^Όνομα/})).toHaveAttribute('aria-sort', 'none');
  });
});
