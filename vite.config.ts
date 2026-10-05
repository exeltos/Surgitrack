import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({command, mode}) => {
  // A build without the Supabase settings would ship a site that cannot start; fail the build instead.
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'].filter(name => !env[name]);
    if (missing.length) throw new Error(`Missing build settings: ${missing.join(', ')} (see .env.example)`);
  }
  return {
    plugins: [react()],
    base: './',
    server: {
      host: '0.0.0.0',
      port: 5174,
      strictPort: true,
    },
    preview: {
      host: '0.0.0.0',
      port: 4174,
      strictPort: true,
    },
  };
});
