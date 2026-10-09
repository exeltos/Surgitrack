import '@testing-library/jest-dom/vitest';
import {loadDemoRepository} from '../data/repositories';

// Store tests run in Demo mode, which needs the sample hospital loaded first (main.tsx does it in the app).
await loadDemoRepository();
