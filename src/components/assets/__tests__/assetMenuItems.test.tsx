import type {ReactNode} from 'react';
import {beforeEach, describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Settings2} from 'lucide-react';
import {LibraryStoreProvider} from '../../../core/LibraryStore';
import {SurgiProvider, useSurgi} from '../../../store/SurgiStore';
import ActionMenu from '../../ui/ActionMenu';
import {useUndoMovement} from '../UndoMovementButton';
import {useStageReturn} from '../StageReturnButton';

const wrapper = ({children}: {children: ReactNode}) => (
  <LibraryStoreProvider>
    <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
  </LibraryStoreProvider>
);

function Menu({id}: {id: string}) {
  const undo = useUndoMovement('TOOL', id);
  const back = useStageReturn('TOOL', id);
  return (
    <>
      <ActionMenu
        icon={<Settings2 size={16} />}
        label="Ενέργειες"
        items={[...(undo.item ? [undo.item] : []), ...(back.item ? [back.item] : [])]}
      />
      {undo.node}
      {back.node}
    </>
  );
}

function Probe() {
  const {tools, sendToSterilization} = useSurgi();
  const tool = tools.find(t => t.mode === 'STANDALONE' && t.state !== 'RETIRED' && !t.maxUses)!;
  return (
    <>
      <button onClick={() => sendToSterilization('TOOL', tool.id)}>send</button>
      <Menu id={tool.id} />
    </>
  );
}

describe('«Αναίρεση» and «Επιστροφή…» on a page of an instrument', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'ADMIN');
  });

  it('are items of the actions menu, not buttons of their own', async () => {
    render(<Probe />, {wrapper});
    await userEvent.click(screen.getByRole('button', {name: 'send'}));
    // Neither is a button of its own any more.
    expect(screen.queryByRole('button', {name: /Αναίρεση|Ακύρωση|Επιστροφή/})).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', {name: /Ενέργειες/}));
    expect(await screen.findByRole('menuitem', {name: /Αναίρεση αποστολής|Ακύρωση αποστολής/})).toBeInTheDocument();
    expect(screen.getByRole('menuitem', {name: /Επιστροφή/})).toBeInTheDocument();
  });
});
