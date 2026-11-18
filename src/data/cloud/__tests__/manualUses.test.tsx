import {describe, expect, it, vi} from 'vitest';
import {renderHook} from '@testing-library/react';
import type {ReactNode} from 'react';
import {ModulesContext, useManualUses} from '../modulesContext';

const owner = vi.hoisted(() => ({value: false}));
vi.mock('../identity', () => ({actingAsPlatformOwner: () => owner.value}));

const withModules =
  (modules: string[]) =>
  ({children}: {children: ReactNode}) => (
    <ModulesContext.Provider value={modules as never}>{children}</ModulesContext.Provider>
  );

describe('correcting uses by hand', () => {
  it('follows the hospital module for its admin and supervisor', () => {
    owner.value = false;
    expect(renderHook(useManualUses, {wrapper: withModules(['MANUAL_USES'])}).result.current).toBe(true);
    expect(renderHook(useManualUses, {wrapper: withModules([])}).result.current).toBe(false);
  });
  it('is always open to the platform owner working as the owner', () => {
    owner.value = true;
    expect(renderHook(useManualUses, {wrapper: withModules([])}).result.current).toBe(true);
  });
});
