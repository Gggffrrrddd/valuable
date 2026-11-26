import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Strip leftover debug logging from production builds only; warnings and
  // errors are kept so real failures still reach the console.
  ...(command === 'build'
    ? { esbuild: { pure: ['console.log', 'console.debug'] } }
    : {}),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
}));
