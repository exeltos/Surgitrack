import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The edge functions import Deno-style specifiers; tests swap in local stand-ins.
    alias: {
      'jsr:@supabase/supabase-js@2': fileURLToPath(
        new URL('./supabase/functions/__tests__/fakes/supabase.ts', import.meta.url),
      ),
      'jsr:@supabase/functions-js/edge-runtime.d.ts': fileURLToPath(
        new URL('./supabase/functions/__tests__/fakes/empty.ts', import.meta.url),
      ),
      'npm:nodemailer@6.9.16': fileURLToPath(
        new URL('./supabase/functions/__tests__/fakes/nodemailer.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    },
  },
});
