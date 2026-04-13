import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// DEV_PROXY=direct  → each service on its own port (no Docker/Kong needed)
// DEV_PROXY=kong    → everything through Kong on :8000 (default / full stack)
const useDirect = process.env['DEV_PROXY'] === 'direct';

const directProxy = {
  '/api/auth':      { target: 'http://localhost:3001', changeOrigin: true },
  '/api/territory': { target: 'http://localhost:3002', changeOrigin: true },
  '/api/vote':      { target: 'http://localhost:3003', changeOrigin: true },
  '/api/economy':   { target: 'http://localhost:3004', changeOrigin: true },
  '/api/profile':   { target: 'http://localhost:3005', changeOrigin: true },
  '/ws':            { target: 'ws://localhost:3003', ws: true, changeOrigin: true },
};

const kongProxy = {
  '/api': { target: 'http://localhost:8000', changeOrigin: true },
  '/ws':  { target: 'ws://localhost:8000',  ws: true, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@feastfite/shared': path.resolve(__dirname, '../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: useDirect ? directProxy : kongProxy,
  },
});
