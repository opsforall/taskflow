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
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Périmètre volontairement réduit à la logique testée au démarrage
      // (le module de thème). On l'élargira à mesure que des tests sont ajoutés.
      include: ['src/theme.js']
      // Pas de `thresholds` : la couverture est MESURÉE et affichée, mais elle
      // ne BLOQUE pas la pipeline (objectif indicatif de 60% au démarrage du
      // module, pour ne pas décourager). On pourra la rendre bloquante plus tard.
    }
  }
});
