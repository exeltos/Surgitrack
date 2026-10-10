import '@testing-library/jest-dom/vitest';
import {loadDemoRepository} from '../data/repositories';

// Store tests run in Demo mode, which needs the sample hospital loaded first (main.tsx does it in the app).
await loadDemoRepository();

// jsdom has no layout: pages that fit their tables to the width observe sizes that never change here.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
