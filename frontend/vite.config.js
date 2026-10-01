import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5002',
        changeOrigin: true,
      },
      // live map: WebSocket traffic for Socket.IO
      '/socket.io': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});