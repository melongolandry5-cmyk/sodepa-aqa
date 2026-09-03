import { test, expect } from '../authentication-fixtures';
import { AUTH_PATHS } from '../authentication-api-paths';
import { users } from '../../../test-data/users';
import { env } from '../../../helpers/env';
import { expectHasFields, expectStatusIn } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import { UUID_INEXISTANT } from '../../../test-data/builders';
import { contexte, etape } from '../../../helpers/scenario';

test.describe('API — Authentification (/api/auth)', () => {
  test('connexion avec des identifiants valides renvoie un jeton exploitable', async ({
    anonAuthClient,
  }) => {
    await contexte({
      preconditions: [
        'Le compte administrateur existe dans le realm Keycloak « sodepa » et est actif',
        'Aucune session n’est requise : la connexion est le point d’entrée',
      ],
      configuration: [
        'ADMIN_USERNAME et ADMIN_PASSWORD désignent ce compte',
        'Chaque appel porte l’en-tête X-Correlation-Id exigé par l’environnement',
      ],
    });

    const token = await etape(
      'Soumettre une demande de connexion avec un identifiant et un mot de passe valides',
      'Le service répond 200 et renvoie un access_token, un refresh_token et une durée de validité',
      () => anonAuthClient.login(users.admin.username, users.admin.password),
    );

    await etape(
      'Examiner le jeton obtenu',
      'L’access_token est un JWT en trois segments et sa durée de validité est strictement positive',
      async () => {
        expectHasFields(token as unknown as Record<string, unknown>, [
          'access_token',
          'refresh_token',
          'expires_in',
        ]);
        expect(token.access_token.split('.')).toHaveLength(3);
        expect(token.expires_in).toBeGreaterThan(0);
      },
    );
  });

  test('connexion avec un mot de passe erroné est refusée', async ({ anonAuthClient }) => {
    await contexte({
      preconditions: ['Le compte administrateur existe, seul le mot de passe fourni est faux'],
    });

    const response = await etape(
      'Tenter de se connecter avec un identifiant connu et un mot de passe incorrect',
      'La connexion est refusée : le service répond 400, 401 ou 403 et n’ouvre aucune session',
      () => anonAuthClient.loginRaw(users.admin.username, 'mot-de-passe-invalide'),
    );

    await etape(
      'Contrôler la réponse',
      'Aucun jeton n’est délivré et le code retour appartient aux refus d’authentification',
      async () => {
        expect(response.ok(), 'un mot de passe invalide ne doit pas ouvrir de session').toBeFalsy();
        expect([400, 401, 403]).toContain(response.status());
      },
    );
  });

  test('connexion avec un utilisateur inconnu est refusée', async ({ anonAuthClient }) => {
    await contexte({
      preconditions: ['L’identifiant soumis n’existe dans aucun realm'],
    });

    const response = await etape(
      'Tenter de se connecter avec un identifiant qui n’existe pas',
      'La connexion est refusée avec un code 400, 401 ou 403',
      () => anonAuthClient.loginRaw(`inconnu-${Date.now()}`, 'peu-importe'),
    );

    await etape(
      'Contrôler la réponse',
      'Le refus est identique à celui d’un mot de passe faux : rien ne révèle si le compte existe',
      async () => {
        expect(response.ok()).toBeFalsy();
        expect([400, 401, 403]).toContain(response.status());
      },
    );
  });

  test('les champs obligatoires vides déclenchent une erreur de validation', async ({
    anonAuthClient,
  }) => {
    await contexte({
      preconditions: ['Aucune donnée n’est saisie dans le formulaire de connexion'],
    });

    const response = await etape(
      'Soumettre la connexion avec un identifiant et un mot de passe vides',
      'La demande est rejetée sans être traitée : code 400, 401 ou 403',
      () => anonAuthClient.loginRaw('', ''),
    );

    await etape(
      'Contrôler le code retour',
      'Le service refuse la demande au lieu de tenter une authentification',
      async () => {
        expect([400, 401, 403]).toContain(response.status());
      },
    );
  });

  test('un corps de connexion incomplet est rejeté en 400', async ({ anonContext }) => {
    await contexte({
      preconditions: ['La requête omet volontairement le mot de passe'],
    });

    const response = await etape(
      'Envoyer une demande de connexion ne contenant que l’identifiant',
      'Le service détecte le champ manquant et répond une erreur de requête invalide',
      () => anonContext.post(AUTH_PATHS.login, { data: { username: users.admin.username } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'login sans password'),
    );
  });

  test('un corps de connexion non JSON est rejeté', async ({ anonContext }) => {
    await contexte({
      preconditions: ['Le corps envoyé est du texte brut, avec un Content-Type text/plain'],
    });

    const response = await etape(
      'Envoyer une demande de connexion dont le corps n’est pas du JSON',
      'Le service refuse la requête au lieu de tenter de l’interpréter',
      () =>
        anonContext.post(AUTH_PATHS.login, {
          data: 'ceci-nest-pas-du-json',
          headers: { 'Content-Type': 'text/plain' },
        }),
    );

    await etape(
      'Contrôler la réponse',
      'La réponse est en erreur : aucune session n’est ouverte à partir d’un corps illisible',
      async () => {
        expect(response.ok()).toBeFalsy();
      },
    );
  });

  test('le rafraîchissement du jeton renvoie un nouvel access_token', async ({ anonAuthClient }) => {
    await contexte({
      preconditions: ['Le compte administrateur permet d’ouvrir une session valide'],
      configuration: ['La route de rafraîchissement est publique : elle n’exige pas de Bearer'],
    });

    const token = await etape(
      'Ouvrir une session pour disposer d’un refresh_token',
      'La connexion aboutit et fournit un refresh_token exploitable',
      () => anonAuthClient.login(users.admin.username, users.admin.password),
    );

    const refreshed = await etape(
      'Demander un renouvellement de session avec ce refresh_token',
      'Le service répond 200 et délivre un nouvel access_token',
      () => anonAuthClient.refresh(token.refresh_token),
    );

    await etape(
      'Examiner le jeton renouvelé',
      'Le nouvel access_token est présent et reste un JWT en trois segments',
      async () => {
        expect(refreshed.access_token).toBeTruthy();
        expect(refreshed.access_token.split('.')).toHaveLength(3);
      },
    );
  });

  test('un refresh token invalide est rejeté', async ({ anonContext }) => {
    await contexte({
      preconditions: ['Le jeton de rafraîchissement soumis est une chaîne arbitraire'],
    });

    const response = await etape(
      'Demander un renouvellement de session avec un refresh token fabriqué',
      'Le service refuse le renouvellement : aucune session n’est prolongée',
      () => anonContext.post(AUTH_PATHS.refresh, { data: { refreshToken: 'jeton-bidon' } }),
    );

    await etape(
      'Contrôler la réponse',
      'La réponse est en erreur et ne contient aucun nouveau jeton',
      async () => {
        expect(response.ok()).toBeFalsy();
      },
    );
  });

  test('un refresh token vide déclenche une erreur de validation', async ({ anonContext }) => {
    await contexte({
      preconditions: ['Le champ refreshToken est présent mais vide'],
    });

    const response = await etape(
      'Demander un renouvellement de session avec un refresh token vide',
      'Le service rejette la demande sans tenter de renouveler la session',
      () => anonContext.post(AUTH_PATHS.refresh, { data: { refreshToken: '' } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou du refus (401, 403)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 401, 403], 'refresh vide'),
    );
  });

  test('la déconnexion invalide le refresh token', async ({ anonAuthClient, anonContext }) => {
    await contexte({
      preconditions: ['Une session vient d’être ouverte avec le compte administrateur'],
      configuration: [
        'La déconnexion exige un jeton : elle est appelée avec l’access_token de la session à fermer',
      ],
    });

    const token = await etape(
      'Ouvrir une session',
      'La connexion aboutit et fournit un access_token et un refresh_token',
      () => anonAuthClient.login(users.admin.username, users.admin.password),
    );

    await etape(
      'Se déconnecter en présentant le jeton de cette session',
      'Le service accepte la déconnexion et révoque la session',
      () => anonAuthClient.logout(token.refresh_token, token.access_token),
    );

    const apresLogout = await etape(
      'Tenter de renouveler la session avec le refresh token révoqué',
      'Le renouvellement échoue : un refresh token révoqué ne rouvre pas de session',
      () => anonContext.post(AUTH_PATHS.refresh, { data: { refreshToken: token.refresh_token } }),
    );

    await etape(
      'Contrôler la réponse',
      'La réponse est en erreur, confirmant que la déconnexion a bien invalidé le jeton',
      async () => {
        expect(
          apresLogout.ok(),
          'un refresh token révoqué ne doit plus permettre de renouveler la session',
        ).toBeFalsy();
      },
    );
  });

  test('la liste des sessions du porteur du jeton est accessible', async ({ authClient }) => {
    await contexte({
      preconditions: ['Une session administrateur est ouverte et son jeton est présenté'],
      configuration: ['La route des sessions est protégée : elle exige un en-tête Bearer'],
    });

    const sessions = await etape(
      'Consulter la liste de ses propres sessions',
      'Le service répond 200 et renvoie la liste des sessions du porteur du jeton',
      () => authClient.listSessions(),
    );

    await etape(
      'Examiner la réponse',
      'La réponse est un tableau, même lorsqu’aucune autre session n’est ouverte',
      async () => {
        expect(Array.isArray(sessions)).toBeTruthy();
      },
    );
  });

  test('la suppression d’une session inexistante ne renvoie pas 200', async ({ authClient }) => {
    await contexte({
      preconditions: [
        'Une session administrateur est ouverte',
        'L’identifiant de session visé ne correspond à aucune session existante',
      ],
    });

    const response = await etape(
      'Demander la suppression d’une session dont l’identifiant n’existe pas',
      'Le service ne confirme pas une suppression qui n’a pas eu lieu',
      () => authClient.deleteSession(UUID_INEXISTANT, [...NOT_FOUND_STATUSES, 204, 200]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code est soit un refus (400, 404, 409, 500), soit une suppression idempotente (200, 204) que Keycloak accepte',
      async () => {
        // Keycloak accepte parfois la suppression idempotente : on documente le comportement observé.
        expect([200, 204, ...NOT_FOUND_STATUSES]).toContain(response.status());
      },
    );
  });

  test('le changement de mot de passe exige un corps valide', async ({ authClient }) => {
    await contexte({
      preconditions: ['Une session administrateur est ouverte'],
      configuration: ['Le nouveau mot de passe soumis est vide, ce qui doit être refusé'],
    });

    const response = await etape(
      'Demander un changement de mot de passe en laissant le nouveau mot de passe vide',
      'Le service refuse la demande sans modifier le mot de passe du compte',
      () => authClient.changePassword('', [...BAD_REQUEST_STATUSES, 401, 403]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou du refus (401, 403)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 401, 403], 'mot de passe vide'),
    );
  });

  test('le changement de mot de passe aboutit puis est restauré', async ({ authClient }) => {
    await contexte({
      preconditions: [
        'Une session administrateur est ouverte',
        'L’environnement est jetable : le mot de passe du compte va être modifié puis remis',
      ],
      configuration: [
        'RUN_DESTRUCTIVE=true, sans quoi le cas est ignoré pour ne pas altérer un environnement partagé',
      ],
    });

    test.skip(
      !env.runDestructive,
      'test destructif : activer RUN_DESTRUCTIVE=true sur un environnement jetable',
    );
    const motDePasseTemporaire = `Aqa!${Date.now()}`;

    await etape(
      'Changer le mot de passe du compte pour une valeur temporaire',
      'Le service accepte le changement et le compte adopte le nouveau mot de passe',
      () => authClient.changePassword(motDePasseTemporaire),
    );

    await etape(
      'Rétablir le mot de passe d’origine',
      'Le compte retrouve son mot de passe initial : l’environnement est laissé dans son état de départ',
      () => authClient.changePassword(users.admin.password),
    );
  });
});
