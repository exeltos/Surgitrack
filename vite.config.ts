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
    build: {
      rollupOptions: {
        output: {
          // Libraries change rarely; in their own files a release re-downloads only the app code.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return 'react';
            if (id.includes('node_modules/@supabase/')) return 'supabase';
            return undefined;
          },
        },
      },
    },
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
