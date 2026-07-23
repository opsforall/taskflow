import { defineConfig, devices } from '@playwright/test';

// Les tests E2E s'exécutent contre l'application DÉPLOYÉE (stack docker compose).
// L'URL cible est surchargeable pour s'adapter au contexte :
//   - CI / local direct : http://localhost:8080
//   - depuis un conteneur : E2E_BASE_URL=http://host.docker.internal:8080
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // interdit les test.only oubliés en CI
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
