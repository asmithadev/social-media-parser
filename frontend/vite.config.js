import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // In development, send /api requests to Express on port 3000.
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
});
