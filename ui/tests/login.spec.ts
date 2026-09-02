import { test, expect } from '../ui-fixtures';
import { users } from '../../test-data/users';

// Le front n'est pas encore branché : ce fichier fixe la structure attendue.
// Retirer le `test.describe.skip` dès que UI_BASE_URL sert l'application.
test.describe.skip('UI — Connexion', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('un utilisateur valide accède au tableau de bord', async ({
    loginPage,
    dashboardPage,
  }) => {
    await loginPage.goto();
    await loginPage.expectDisplayed();

    await loginPage.login(users.admin);

    await dashboardPage.expectDisplayed();
  });

  test('des identifiants invalides affichent une erreur et maintiennent sur /login', async ({
    page,
    loginPage,
  }) => {
    await loginPage.goto();

    await loginPage.login({ username: users.admin.username, password: 'invalide' });

    await expect(loginPage.errorMessage).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
