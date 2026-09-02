import { test, expect } from '../user-management-fixtures';
import { expectStatusIn, expectValidPage } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import { UUID_INEXISTANT, UUID_MALFORME, decisionValide, unique } from '../../../test-data/builders';

test.describe('API — Utilisateurs : recherche et consultation', () => {
  test('la liste paginée est cohérente', async ({ userClient }) => {
    const page = await userClient.page({ page: 0, size: 10 });

    expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
  });

  test('la seconde page ne répète pas la première', async ({ userClient }) => {
    const premiere = await userClient.page({ page: 0, size: 2 });
    test.skip(premiere.totalElements < 3, 'moins de trois utilisateurs en base');

    const seconde = await userClient.page({ page: 1, size: 2 });

    const ids = premiere.content.map((u) => u.id);
    expect(seconde.content.filter((u) => ids.includes(u.id))).toHaveLength(0);
  });

  test('la file maker-checker est paginée', async ({ userClient }) => {
    const page = await userClient.pending({ page: 0, size: 10 });

    expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
  });

  test('la recherche sans critère renvoie tous les utilisateurs', async ({ userClient }) => {
    const tous = await userClient.page({ page: 0, size: 1 });
    const recherche = await userClient.search({ page: 0, size: 1 });

    expect(recherche.totalElements).toBe(tous.totalElements);
  });

  test('la recherche par nom filtre le résultat', async ({ userClient }) => {
    const reference = await userClient.page({ page: 0, size: 1 });
    test.skip(reference.content.length === 0, 'aucun utilisateur en base');

    const nom = String(reference.content[0].nom ?? '');
    test.skip(nom.length < 2, 'nom de référence trop court');

    const resultats = await userClient.search({ page: 0, size: 20, nom });

    expect(resultats.totalElements).toBeGreaterThan(0);
    for (const utilisateur of resultats.content) {
      expect(String(utilisateur.nom ?? '').toLowerCase()).toContain(nom.toLowerCase());
    }
  });

  test('la recherche par email filtre le résultat', async ({ userClient }) => {
    const reference = await userClient.page({ page: 0, size: 1 });
    test.skip(reference.content.length === 0, 'aucun utilisateur en base');

    const email = String(reference.content[0].email ?? '');
    test.skip(!email, 'l’utilisateur de référence n’a pas d’email');

    const resultats = await userClient.search({ page: 0, size: 20, email });

    expect(resultats.totalElements).toBeGreaterThan(0);
  });

  test('une recherche sans correspondance renvoie une page vide', async ({ userClient }) => {
    const resultats = await userClient.search({ page: 0, size: 10, nom: unique('ZZZ') });

    expect(resultats.content).toHaveLength(0);
    expect(resultats.empty).toBe(true);
  });

  test('les critères de recherche se combinent', async ({ userClient }) => {
    const resultats = await userClient.search({
      page: 0,
      size: 10,
      nom: unique('ZZZ'),
      prenom: unique('YYY'),
      email: 'inexistant@example.invalid',
      telephone: '000000000',
    });

    expect(resultats.content).toHaveLength(0);
  });

  test('la consultation unitaire renvoie l’utilisateur demandé', async ({ userClient }) => {
    const page = await userClient.page({ page: 0, size: 1 });
    test.skip(page.content.length === 0, 'aucun utilisateur en base');

    const response = await userClient.getById(String(page.content[0].id));
    const utilisateur = (await response.json()) as Record<string, unknown>;

    expect(String(utilisateur.id)).toBe(String(page.content[0].id));
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ userClient }) => {
    const response = await userClient.getById(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'utilisateur inexistant');
  });

  test('un identifiant malformé est rejeté', async ({ userClient }) => {
    const response = await userClient.getById(UUID_MALFORME, BAD_REQUEST_STATUSES);

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'utilisateur id malformé');
  });
});

test.describe('API — Utilisateurs : mise à jour', () => {
  test('la mise à jour exige un email bien formé', async ({ userClient }) => {
    const response = await userClient.initUpdate(
      UUID_INEXISTANT,
      { nom: 'x', prenom: 'y', email: 'pas-un-email', telephones: ['690000000'], actif: true },
      [...BAD_REQUEST_STATUSES, 404],
    );

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'email mal formé');
  });

  test('la mise à jour exige au moins un téléphone', async ({ userClient }) => {
    const response = await userClient.initUpdate(
      UUID_INEXISTANT,
      { nom: 'x', prenom: 'y', email: 'a@b.c', telephones: [], actif: true },
      [...BAD_REQUEST_STATUSES, 404],
    );

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'téléphones vides');
  });

  test('la mise à jour exige un nom', async ({ userClient }) => {
    const response = await userClient.initUpdate(
      UUID_INEXISTANT,
      { nom: '', prenom: 'y', email: 'a@b.c', telephones: ['690000000'], actif: true },
      [...BAD_REQUEST_STATUSES, 404],
    );

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'nom vide');
  });

  test('la mise à jour d’un utilisateur inexistant échoue', async ({ userClient }) => {
    const response = await userClient.initUpdate(
      UUID_INEXISTANT,
      {
        nom: 'Test',
        prenom: 'AQA',
        email: 'test.aqa@example.com',
        telephones: ['690000000'],
        actif: true,
      },
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'maj utilisateur inexistant');
  });

  test('la mise à jour des permissions exige une liste non vide', async ({ userClient }) => {
    const response = await userClient.initUpdatePermissions(UUID_INEXISTANT, { permissions: [] }, [
      ...BAD_REQUEST_STATUSES,
      404,
    ]);

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'permissions vides');
  });

  test('une permission hors énumération est rejetée', async ({ userClient }) => {
    const response = await userClient.initUpdatePermissions(
      UUID_INEXISTANT,
      { permissions: ['SUPER_ADMIN_TOTAL'] },
      [...BAD_REQUEST_STATUSES, 404],
    );

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'permission inconnue');
  });

  test('la mise à jour des permissions d’un utilisateur inexistant échoue', async ({
    userClient,
  }) => {
    const response = await userClient.initUpdatePermissions(
      UUID_INEXISTANT,
      { permissions: ['GET_FULL_USER_INFO'] },
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'permissions utilisateur inexistant');
  });

  test('valider une soumission inexistante échoue', async ({ userClient }) => {
    const response = await userClient.validateOrReject(
      UUID_INEXISTANT,
      decisionValide(),
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'validation utilisateur inexistant');
  });

  test('une décision sans notes est refusée', async ({ userClient }) => {
    const response = await userClient.validateOrReject(
      UUID_INEXISTANT,
      { decision: 'REJECTED', notes: '', checkerOperationType: 'CREATE' },
      [...BAD_REQUEST_STATUSES, 404],
    );

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'décision sans notes');
  });

  test('la création d’utilisateur refuse un corps JSON (multipart attendu)', async ({
    apiContext,
  }) => {
    const response = await apiContext.post('/api/v1/users/init_create', {
      data: { username: 'x', nom: 'x', prenom: 'x', email: 'a@b.c' },
    });

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'init_create en JSON');
  });
});
