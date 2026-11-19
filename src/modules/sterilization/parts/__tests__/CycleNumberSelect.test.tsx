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
  it('shows a number past the ones offered as it is', () => {
    render(<CycleNumberSelect {...props} value="A123" onChange={vi.fn()} fromDevice />);
    expect(screen.getByRole('combobox')).toHaveValue('A123');
  });
});
