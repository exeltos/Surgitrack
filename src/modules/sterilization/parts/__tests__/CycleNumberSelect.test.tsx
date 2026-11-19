import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import CycleNumberSelect from '../CycleNumberSelect';

const sterilizers = [{id: 'a', el: 'Κλίβανος 1', en: 'Sterilizer 1', cyclePrefix: 'A'}];
const props = {sterilizer: sterilizers[0], sterilizers, equipment: 'Κλίβανος 1', loads: []};

describe('CycleNumberSelect', () => {
  it("picks today's next number of the sterilizer", () => {
    const onChange = vi.fn();
    render(<CycleNumberSelect {...props} value="" onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith('A1');
  });
  it("keeps a device's number, whatever its letter, and shows it", () => {
    const onChange = vi.fn();
    render(<CycleNumberSelect {...props} value="B123" onChange={onChange} fromDevice />);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toHaveValue('B123');
  });
  it('moves on when the number picked is taken meanwhile by another workstation', () => {
    const onChange = vi.fn();
    const now = new Date();
    const at = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} 00:01`;
    const loads = [{equipment: 'Κλίβανος 1', cycleNumber: 'A1', createdAt: at, kind: 'STERILIZATION'}];
    render(<CycleNumberSelect {...props} loads={loads as never} value="A1" onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith('A2');
  });
  it("shows the sterilizer's previous cycle today, or that this is the day's first", () => {
    const now = new Date();
    const day = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const loads = [
      {equipment: 'Κλίβανος 1', cycleNumber: 'A1', createdAt: `${day} 00:01`, kind: 'STERILIZATION'},
      {equipment: 'Κλίβανος 1', cycleNumber: 'A2', createdAt: `${day} 00:02`, kind: 'STERILIZATION'},
    ];
    const {unmount} = render(<CycleNumberSelect {...props} loads={loads as never} value="A3" onChange={vi.fn()} />);
    expect(screen.getByText('Προηγούμενος σήμερα: 2 · 00:02')).toBeInTheDocument();
    unmount();
    render(<CycleNumberSelect {...props} value="A1" onChange={vi.fn()} />);
    expect(screen.getByText('Πρώτος κύκλος της ημέρας')).toBeInTheDocument();
  });
  it('shows a number past the ones offered as it is', () => {
    render(<CycleNumberSelect {...props} value="A123" onChange={vi.fn()} fromDevice />);
    expect(screen.getByRole('combobox')).toHaveValue('A123');
  });
});
