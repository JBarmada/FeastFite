import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@feastfite/shared': path.resolve(__dirname, '../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // TODO: switch target back to Kong (http://localhost:8000) when full stack is running
      '/api/territory': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/territory/, '/api/territory'),
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
