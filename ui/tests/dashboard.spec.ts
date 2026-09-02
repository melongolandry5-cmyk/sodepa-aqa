import { test } from '../ui-fixtures';

// Réactiver dès que le front est disponible (session réutilisée depuis .auth/user.json).
test.describe.skip('UI — Tableau de bord', () => {
  test('la navigation principale est affichée pour un utilisateur connecté', async ({
    dashboardPage,
  }) => {
    await dashboardPage.goto();
    await dashboardPage.expectDisplayed();
  });
});
