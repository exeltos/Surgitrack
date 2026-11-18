import {describe, expect, it} from 'vitest';
import {fireEvent, screen} from '@testing-library/react';
import {renderPage} from '../../../test/renderPage';
import DepartmentDispatchModal from '../DepartmentDispatchModal';
import {sets, tools} from '../../../data/demo';
import type {SessionUser} from '../../../store/types';

// A standalone limited-use instrument in the Delivery suite (the Demo has some, with their uses counted).
const tool = tools.find(t => t.mode === 'STANDALONE' && t.department === 'Αίθουσα Τοκετών' && t.maxUses)!;
const user: SessionUser = {id: 'u-tok', name: 'Δοκιμή', role: 'DEPARTMENT', department: 'Αίθουσα Τοκετών'};
const send = () => screen.getByRole('button', {name: 'Αποστολή προς Αποστείρωση'});

describe('the patient code a department requires', () => {
  it('is asked for while a use is recorded, not when the limited-use instrument goes back unused', () => {
    renderPage(
      <DepartmentDispatchModal kind="TOOL" id={tool.id} barcode={tool.barcode} name={tool.name} onClose={() => {}} />,
      {
        signedIn: user,
        demo: true,
        library: {systemSettings: {usageWarningThreshold: 3, patientCodeDepartments: ['Αίθουσα Τοκετών']}},
      },
    );
    // Used: the code and the confirmation are needed.
    fireEvent.click(screen.getByRole('checkbox', {name: /Επιβεβαιώνω ότι χρησιμοποιήθηκε/}));
    expect(send()).toBeDisabled();
    // Not used: it goes back with no use recorded, and no patient code.
    fireEvent.click(screen.getByRole('checkbox', {name: `Χρησιμοποιήθηκε: ${tool.barcode}`}));
    expect(send()).toBeEnabled();
  });

  it('stays required for a Set even with its limited-use instruments unticked (the others were used)', () => {
    // A Set in the Delivery suite with limited-use instruments and others without a limit.
    const set = sets.find(
      x =>
        x.department === 'Αίθουσα Τοκετών' &&
        !x.maxUses &&
        tools.some(t => t.setId === x.id && t.maxUses) &&
        tools.some(t => t.setId === x.id && !t.maxUses),
    )!;
    renderPage(
      <DepartmentDispatchModal kind="SET" id={set.id} barcode={set.barcode} name={set.name} onClose={() => {}} />,
      {
        signedIn: user,
        demo: true,
        library: {systemSettings: {usageWarningThreshold: 3, patientCodeDepartments: ['Αίθουσα Τοκετών']}},
      },
    );
    for (const box of screen.getAllByRole('checkbox', {name: /^Χρησιμοποιήθηκε: /})) fireEvent.click(box);
    expect(send()).toBeDisabled();
  });
});
