import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En dev, les appels /api sont relayés vers le backend local
    // (en prod c'est nginx qui joue ce rôle — voir nginx/default.conf.template)
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  test: {
    environment: 'node'
  }
});
