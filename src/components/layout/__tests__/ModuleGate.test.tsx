import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import ModuleGate from '../ModuleGate';
import {ModulesContext} from '../../../data/cloud/modulesContext';

const open = (modules: Parameters<typeof ModulesContext.Provider>[0]['value']) =>
  render(
    <ModulesContext.Provider value={modules}>
      <MemoryRouter initialEntries={['/devices']}>
        <Routes>
          <Route path="/" element={<p>Αρχική</p>} />
          <Route
            path="/devices"
            element={
              <ModuleGate module="DEVICES">
                <p>Συσκευές</p>
              </ModuleGate>
            }
          />
        </Routes>
      </MemoryRouter>
    </ModulesContext.Provider>,
  );

describe('the screen of a module', () => {
  it('opens when the hospital has the module', () => {
    open(['DEVICES']);
    expect(screen.getByText('Συσκευές')).toBeInTheDocument();
  });

  it('leads to the home when the platform owner has not given it', () => {
    open(['REPLACEMENTS']);
    expect(screen.queryByText('Συσκευές')).toBeNull();
    expect(screen.getByText('Αρχική')).toBeInTheDocument();
  });

  it('opens for a hospital that says nothing (all modules on)', () => {
    open(null);
    expect(screen.getByText('Συσκευές')).toBeInTheDocument();
  });
});
