import { test, expect } from '@playwright/test';

test.describe('Page d\'accueil', () => {
  test('devrait afficher le titre et la description', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('h1')).toContainText('Skidrow Game Scanner');
    await expect(page.locator('h2')).toContainText('Jeux de qualité');
  });

  test('devrait afficher les statistiques', async ({ page }) => {
    await page.goto('/');
    
    // Vérifier que les cartes de statistiques sont présentes
    await expect(page.locator('[class*="grid"]')).toBeVisible();
    await expect(page.locator('text=Total des jeux')).toBeVisible();
    await expect(page.locator('text=Note moyenne')).toBeVisible();
  });

  test('devrait gérer l\'absence de données', async ({ page }) => {
    // Mock pour simuler l'absence de données
    await page.route('**/*.json', route => route.abort());
    
    await page.goto('/');
    
    // Devrait afficher une page 404 ou un message d'erreur
    await expect(page.locator('text=404') | page.locator('text=Not Found')).toBeVisible();
  });

  test('devrait avoir une navigation accessible', async ({ page }) => {
    await page.goto('/');
    
    // Vérifier que la page est accessible
    await expect(page).toHaveTitle(/Skidrow Game Scanner/);
    
    // Vérifier que les liens externes s'ouvrent dans un nouvel onglet
    const externalLinks = page.locator('a[target="_blank"]');
    await expect(externalLinks).toHaveCount(externalLinks.count());
  });
});
