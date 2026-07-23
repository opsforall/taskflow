import { test, expect } from '@playwright/test';

// Génère un email unique pour éviter toute collision entre exécutions/retries.
function uniqueEmail() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@taskflow.test`;
}

async function register(page, email) {
  await page.goto('/register');
  await page.getByPlaceholder('Votre nom').fill('Utilisateur E2E');
  await page.getByPlaceholder('vous@exemple.com').fill(email);
  await page.getByPlaceholder('8 caractères minimum').fill('Password123');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  // Redirection vers le tableau de bord = inscription réussie
  await expect(page.getByRole('button', { name: 'Nouvelle tâche' })).toBeVisible();
}

test("inscription puis création d'une tâche", async ({ page }) => {
  await register(page, uniqueEmail());

  await page.getByRole('button', { name: 'Nouvelle tâche' }).click();
  await page.getByPlaceholder('Ex. : Écrire le Dockerfile du backend').fill('Ma première tâche E2E');
  await page.getByRole('button', { name: 'Créer la tâche' }).click();

  // La tâche apparaît sur le tableau
  await expect(page.getByText('Ma première tâche E2E')).toBeVisible();
});

test('la tâche persiste après rechargement (API + base réelles)', async ({ page }) => {
  await register(page, uniqueEmail());

  await page.getByRole('button', { name: 'Nouvelle tâche' }).click();
  await page.getByPlaceholder('Ex. : Écrire le Dockerfile du backend').fill('Tâche persistante');
  await page.getByRole('button', { name: 'Créer la tâche' }).click();
  await expect(page.getByText('Tâche persistante')).toBeVisible();

  // Rechargement : le token (localStorage) et la tâche (base) survivent
  await page.reload();
  await expect(page.getByText('Tâche persistante')).toBeVisible();
});
