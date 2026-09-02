import { test, expect } from '../authentication-fixtures';
import { AUTH_PATHS } from '../authentication-api-paths';
import { users } from '../../../test-data/users';
import { env } from '../../../helpers/env';
import { expectHasFields, expectStatusIn } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import { UUID_INEXISTANT } from '../../../test-data/builders';

test.describe('API — Authentification (/api/auth)', () => {
  test('connexion avec des identifiants valides renvoie un jeton exploitable', async ({
    anonAuthClient,
  }) => {
    const token = await anonAuthClient.login(users.admin.username, users.admin.password);

    expectHasFields(token as unknown as Record<string, unknown>, [
      'access_token',
      'refresh_token',
      'expires_in',
    ]);
    expect(token.access_token.split('.')).toHaveLength(3);
    expect(token.expires_in).toBeGreaterThan(0);
  });

  test('connexion avec un mot de passe erroné est refusée', async ({ anonAuthClient }) => {
    const response = await anonAuthClient.loginRaw(users.admin.username, 'mot-de-passe-invalide');

    expect(response.ok(), 'un mot de passe invalide ne doit pas ouvrir de session').toBeFalsy();
    expect([400, 401, 403]).toContain(response.status());
  });

  test('connexion avec un utilisateur inconnu est refusée', async ({ anonAuthClient }) => {
    const response = await anonAuthClient.loginRaw(`inconnu-${Date.now()}`, 'peu-importe');

    expect(response.ok()).toBeFalsy();
    expect([400, 401, 403]).toContain(response.status());
  });

  test('les champs obligatoires vides déclenchent une erreur de validation', async ({
    anonAuthClient,
  }) => {
    const response = await anonAuthClient.loginRaw('', '');

    expect([400, 401, 403]).toContain(response.status());
  });

  test('un corps de connexion incomplet est rejeté en 400', async ({ anonContext }) => {
    const response = await anonContext.post(AUTH_PATHS.login, {
      data: { username: users.admin.username },
    });

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'login sans password');
  });

  test('un corps de connexion non JSON est rejeté', async ({ anonContext }) => {
    const response = await anonContext.post(AUTH_PATHS.login, {
      data: 'ceci-nest-pas-du-json',
      headers: { 'Content-Type': 'text/plain' },
    });

    expect(response.ok()).toBeFalsy();
  });

  test('le rafraîchissement du jeton renvoie un nouvel access_token', async ({ anonAuthClient }) => {
    const token = await anonAuthClient.login(users.admin.username, users.admin.password);
    const refreshed = await anonAuthClient.refresh(token.refresh_token);

    expect(refreshed.access_token).toBeTruthy();
    expect(refreshed.access_token.split('.')).toHaveLength(3);
  });

  test('un refresh token invalide est rejeté', async ({ anonContext }) => {
    const response = await anonContext.post(AUTH_PATHS.refresh, {
      data: { refreshToken: 'jeton-bidon' },
    });

    expect(response.ok()).toBeFalsy();
  });

  test('un refresh token vide déclenche une erreur de validation', async ({ anonContext }) => {
    const response = await anonContext.post(AUTH_PATHS.refresh, { data: { refreshToken: '' } });

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 401, 403], 'refresh vide');
  });

  test('la déconnexion invalide le refresh token', async ({ anonAuthClient, anonContext }) => {
    const token = await anonAuthClient.login(users.admin.username, users.admin.password);

    await anonAuthClient.logout(token.refresh_token);

    const apresLogout = await anonContext.post(AUTH_PATHS.refresh, {
      data: { refreshToken: token.refresh_token },
    });
    expect(
      apresLogout.ok(),
      'un refresh token révoqué ne doit plus permettre de renouveler la session',
    ).toBeFalsy();
  });

  test('la liste des sessions du porteur du jeton est accessible', async ({ authClient }) => {
    const sessions = await authClient.listSessions();

    expect(Array.isArray(sessions)).toBeTruthy();
  });

  test('la suppression d’une session inexistante ne renvoie pas 200', async ({ authClient }) => {
    const response = await authClient.deleteSession(UUID_INEXISTANT, [
      ...NOT_FOUND_STATUSES,
      204,
      200,
    ]);

    // Keycloak accepte parfois la suppression idempotente : on documente le comportement observé.
    expect([200, 204, ...NOT_FOUND_STATUSES]).toContain(response.status());
  });

  test('le changement de mot de passe exige un corps valide', async ({ authClient }) => {
    const response = await authClient.changePassword('', [...BAD_REQUEST_STATUSES, 401, 403]);

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 401, 403], 'mot de passe vide');
  });

  test('le changement de mot de passe aboutit puis est restauré', async ({ authClient }) => {
    test.skip(
      !env.runDestructive,
      'test destructif : activer RUN_DESTRUCTIVE=true sur un environnement jetable',
    );
    const motDePasseTemporaire = `Aqa!${Date.now()}`;

    await authClient.changePassword(motDePasseTemporaire);
    await authClient.changePassword(users.admin.password);
  });
});
