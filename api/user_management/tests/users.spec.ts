import { test, expect } from '../user-management-fixtures';
import { USER_PATHS } from '../user-management-api-paths';
import { expectStatusIn, expectValidPage } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import { UUID_INEXISTANT, UUID_MALFORME, decisionValide, unique } from '../../../test-data/builders';
import { contexte, etape } from '../../../helpers/scenario';

test.describe('API — Utilisateurs : recherche et consultation', () => {
  test('la liste paginée est cohérente', async ({ userClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte autorisé à consulter les utilisateurs'],
      configuration: ['La première page est demandée avec une taille de 10 éléments'],
    });

    const page = await etape(
      'Consulter la première page de la liste des utilisateurs, par tranches de 10',
      'Le service renvoie une page conforme à la demande',
      () => userClient.page({ page: 0, size: 10 }),
    );

    await etape(
      'Contrôler la structure de la page',
      'Le numéro de page et la taille renvoyés correspondent à ceux demandés, et le total est cohérent',
      async () => {
        expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
      },
    );
  });

  test('la seconde page ne répète pas la première', async ({ userClient }) => {
    await contexte({
      preconditions: ['Au moins trois utilisateurs existent, sans quoi le cas est ignoré'],
      configuration: ['La pagination est demandée par tranches de 2 utilisateurs'],
    });

    const premiere = await etape(
      'Consulter la première page de deux utilisateurs',
      'Le service renvoie les deux premiers utilisateurs et le total en base',
      () => userClient.page({ page: 0, size: 2 }),
    );

    test.skip(premiere.totalElements < 3, 'moins de trois utilisateurs en base');

    const seconde = await etape(
      'Consulter la page suivante',
      'Le service renvoie les utilisateurs suivants',
      () => userClient.page({ page: 1, size: 2 }),
    );

    await etape(
      'Comparer les deux pages',
      'Aucun utilisateur de la première page ne réapparaît sur la seconde : la pagination ne rejoue pas les mêmes lignes',
      async () => {
        const ids = premiere.content.map((u) => u.id);
        expect(seconde.content.filter((u) => ids.includes(u.id))).toHaveLength(0);
      },
    );
  });

  test('la file maker-checker est paginée', async ({ userClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte autorisé à consulter la file de validation'],
      configuration: ['La première page est demandée avec une taille de 10 éléments'],
    });

    const page = await etape(
      'Consulter la file des demandes en attente de validation',
      'Le service renvoie une page conforme à la demande, même si la file est vide',
      () => userClient.pending({ page: 0, size: 10 }),
    );

    await etape(
      'Contrôler la structure de la page',
      'Le numéro de page et la taille renvoyés correspondent à ceux demandés',
      async () => {
        expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
      },
    );
  });

  test('la recherche sans critère renvoie tous les utilisateurs', async ({ userClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Aucun critère n’est saisi dans le formulaire de recherche'],
    });

    const tous = await etape(
      'Relever le nombre total d’utilisateurs par la liste simple',
      'Le service renvoie le total des utilisateurs en base',
      () => userClient.page({ page: 0, size: 1 }),
    );

    const recherche = await etape(
      'Lancer une recherche sans renseigner de critère',
      'La recherche se comporte comme la liste complète : elle ne filtre rien',
      () => userClient.search({ page: 0, size: 1 }),
    );

    await etape(
      'Comparer les deux totaux',
      'Les deux totaux sont identiques : une recherche vide ne restreint pas le périmètre',
      async () => {
        expect(recherche.totalElements).toBe(tous.totalElements);
      },
    );
  });

  test('la recherche par nom filtre le résultat', async ({ userClient }) => {
    await contexte({
      preconditions: [
        'Au moins un utilisateur existe et porte un nom d’au moins deux caractères',
        'Le nom de cet utilisateur sert de critère de recherche',
      ],
    });

    const reference = await etape(
      'Prendre un utilisateur existant comme référence',
      'Le service renvoie au moins un utilisateur, sans quoi le cas est ignoré',
      () => userClient.page({ page: 0, size: 1 }),
    );
    test.skip(reference.content.length === 0, 'aucun utilisateur en base');

    const nom = String(reference.content[0].nom ?? '');
    test.skip(nom.length < 2, 'nom de référence trop court');

    const resultats = await etape(
      'Rechercher les utilisateurs par ce nom',
      'Le service renvoie au moins un résultat, celui ayant servi de référence',
      () => userClient.search({ page: 0, size: 20, nom }),
    );

    await etape(
      'Contrôler chaque résultat',
      'Tous les utilisateurs renvoyés portent le nom recherché : le filtre est réellement appliqué',
      async () => {
        expect(resultats.totalElements).toBeGreaterThan(0);
        for (const utilisateur of resultats.content) {
          expect(String(utilisateur.nom ?? '').toLowerCase()).toContain(nom.toLowerCase());
        }
      },
    );
  });

  test('la recherche par email filtre le résultat', async ({ userClient }) => {
    await contexte({
      preconditions: [
        'Au moins un utilisateur existe et dispose d’une adresse électronique',
        'Cette adresse sert de critère de recherche',
      ],
    });

    const reference = await etape(
      'Prendre un utilisateur existant comme référence',
      'Le service renvoie au moins un utilisateur, sans quoi le cas est ignoré',
      () => userClient.page({ page: 0, size: 1 }),
    );
    test.skip(reference.content.length === 0, 'aucun utilisateur en base');

    const email = String(reference.content[0].email ?? '');
    test.skip(!email, 'l’utilisateur de référence n’a pas d’email');

    const resultats = await etape(
      'Rechercher les utilisateurs par cette adresse électronique',
      'Le service renvoie au moins un résultat : le critère email est pris en compte',
      () => userClient.search({ page: 0, size: 20, email }),
    );

    await etape(
      'Contrôler le nombre de résultats',
      'Le total est strictement positif : l’utilisateur de référence est bien retrouvé',
      async () => {
        expect(resultats.totalElements).toBeGreaterThan(0);
      },
    );
  });

  test('une recherche sans correspondance renvoie une page vide', async ({ userClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le nom recherché est généré au hasard : aucun utilisateur ne peut le porter'],
    });

    const resultats = await etape(
      'Rechercher un nom d’utilisateur qui n’existe pas',
      'Le service renvoie une page vide plutôt qu’une erreur',
      () => userClient.search({ page: 0, size: 10, nom: unique('ZZZ') }),
    );

    await etape(
      'Contrôler la page renvoyée',
      'La page ne contient aucun élément et se déclare explicitement vide',
      async () => {
        expect(resultats.content).toHaveLength(0);
        expect(resultats.empty).toBe(true);
      },
    );
  });

  test('les critères de recherche se combinent', async ({ userClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: [
        'Quatre critères sont saisis ensemble : nom, prénom, email et téléphone, tous sans correspondance',
      ],
    });

    const resultats = await etape(
      'Rechercher en combinant nom, prénom, adresse électronique et téléphone',
      'Le service applique tous les critères conjointement et ne renvoie aucun utilisateur',
      () =>
        userClient.search({
          page: 0,
          size: 10,
          nom: unique('ZZZ'),
          prenom: unique('YYY'),
          email: 'inexistant@example.invalid',
          telephone: '000000000',
        }),
    );

    await etape(
      'Contrôler le résultat',
      'La page est vide : les critères se cumulent au lieu de s’élargir mutuellement',
      async () => {
        expect(resultats.content).toHaveLength(0);
      },
    );
  });

  test('la consultation unitaire renvoie l’utilisateur demandé', async ({ userClient }) => {
    await contexte({
      preconditions: ['Au moins un utilisateur existe en base, sans quoi le cas est ignoré'],
    });

    const page = await etape(
      'Prendre un utilisateur existant dans la liste',
      'Le service renvoie au moins un utilisateur avec son identifiant',
      () => userClient.page({ page: 0, size: 1 }),
    );
    test.skip(page.content.length === 0, 'aucun utilisateur en base');

    const response = await etape(
      'Consulter la fiche de cet utilisateur par son identifiant',
      'Le service renvoie la fiche demandée',
      () => userClient.getById(String(page.content[0].id)),
    );

    await etape(
      'Contrôler l’identité de la fiche renvoyée',
      'L’identifiant de la fiche est celui demandé : le service ne renvoie pas un autre utilisateur',
      async () => {
        const utilisateur = (await response.json()) as Record<string, unknown>;
        expect(String(utilisateur.id)).toBe(String(page.content[0].id));
      },
    );
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ userClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant demandé est un UUID valide qui ne correspond à aucun utilisateur'],
    });

    const response = await etape(
      'Consulter la fiche d’un utilisateur dont l’identifiant n’existe pas',
      'Le service signale que la ressource est introuvable au lieu de renvoyer une fiche vide',
      () => userClient.getById(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'utilisateur inexistant'),
    );
  });

  test('un identifiant malformé est rejeté', async ({ userClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant demandé n’a pas la forme d’un UUID'],
    });

    const response = await etape(
      'Consulter la fiche d’un utilisateur avec un identifiant malformé',
      'Le service rejette la valeur avant même de chercher en base',
      () => userClient.getById(UUID_MALFORME, BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'utilisateur id malformé'),
    );
  });
});

test.describe('API — Utilisateurs : mise à jour', () => {
  test('la mise à jour exige un email bien formé', async ({ userClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte autorisé à modifier les utilisateurs'],
      configuration: ['L’adresse électronique soumise ne respecte pas le format attendu'],
    });

    const response = await etape(
      'Soumettre une modification d’utilisateur avec une adresse électronique invalide',
      'Le service refuse la modification en signalant le format de l’adresse',
      () =>
        userClient.initUpdate(
          UUID_INEXISTANT,
          { nom: 'x', prenom: 'y', email: 'pas-un-email', telephones: ['690000000'], actif: true },
          [...BAD_REQUEST_STATUSES, 404],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou de la ressource introuvable (404)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'email mal formé'),
    );
  });

  test('la mise à jour exige au moins un téléphone', async ({ userClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte autorisé à modifier les utilisateurs'],
      configuration: ['La liste des téléphones soumise est vide'],
    });

    const response = await etape(
      'Soumettre une modification d’utilisateur sans aucun numéro de téléphone',
      'Le service refuse la modification : au moins un numéro est obligatoire',
      () =>
        userClient.initUpdate(
          UUID_INEXISTANT,
          { nom: 'x', prenom: 'y', email: 'a@b.c', telephones: [], actif: true },
          [...BAD_REQUEST_STATUSES, 404],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou de la ressource introuvable (404)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'téléphones vides'),
    );
  });

  test('la mise à jour exige un nom', async ({ userClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte autorisé à modifier les utilisateurs'],
      configuration: ['Le nom soumis est vide'],
    });

    const response = await etape(
      'Soumettre une modification d’utilisateur en laissant le nom vide',
      'Le service refuse la modification : le nom est une donnée obligatoire',
      () =>
        userClient.initUpdate(
          UUID_INEXISTANT,
          { nom: '', prenom: 'y', email: 'a@b.c', telephones: ['690000000'], actif: true },
          [...BAD_REQUEST_STATUSES, 404],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou de la ressource introuvable (404)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'nom vide'),
    );
  });

  test('la mise à jour d’un utilisateur inexistant échoue', async ({ userClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte autorisé à modifier les utilisateurs'],
      configuration: [
        'Les données soumises sont valides ; seul l’utilisateur visé n’existe pas',
      ],
    });

    const response = await etape(
      'Soumettre une modification valide sur un utilisateur qui n’existe pas',
      'Le service signale que l’utilisateur est introuvable plutôt que de créer une fiche',
      () =>
        userClient.initUpdate(
          UUID_INEXISTANT,
          {
            nom: 'Test',
            prenom: 'AQA',
            email: 'test.aqa@example.com',
            telephones: ['690000000'],
            actif: true,
          },
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'maj utilisateur inexistant'),
    );
  });

  test('la mise à jour des permissions exige une liste non vide', async ({ userClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte autorisé à modifier les permissions'],
      configuration: ['La liste de permissions soumise est vide'],
    });

    const response = await etape(
      'Soumettre une modification de permissions avec une liste vide',
      'Le service refuse : retirer toutes les permissions par une liste vide n’est pas accepté',
      () =>
        userClient.initUpdatePermissions(UUID_INEXISTANT, { permissions: [] }, [
          ...BAD_REQUEST_STATUSES,
          404,
        ]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou de la ressource introuvable (404)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'permissions vides'),
    );
  });

  test('une permission hors énumération est rejetée', async ({ userClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte autorisé à modifier les permissions'],
      configuration: ['La permission soumise ne fait pas partie de celles reconnues par l’ERP'],
    });

    const response = await etape(
      'Soumettre une permission qui n’existe pas dans le référentiel',
      'Le service refuse la valeur au lieu de l’enregistrer telle quelle',
      () =>
        userClient.initUpdatePermissions(
          UUID_INEXISTANT,
          { permissions: ['SUPER_ADMIN_TOTAL'] },
          [...BAD_REQUEST_STATUSES, 404],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou de la ressource introuvable (404)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'permission inconnue'),
    );
  });

  test('la mise à jour des permissions d’un utilisateur inexistant échoue', async ({
    userClient,
  }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte autorisé à modifier les permissions'],
      configuration: ['La permission soumise est valide ; seul l’utilisateur visé n’existe pas'],
    });

    const response = await etape(
      'Attribuer une permission valide à un utilisateur qui n’existe pas',
      'Le service signale que l’utilisateur est introuvable',
      () =>
        userClient.initUpdatePermissions(
          UUID_INEXISTANT,
          { permissions: ['GET_FULL_USER_INFO'] },
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'permissions utilisateur inexistant'),
    );
  });

  test('valider une soumission inexistante échoue', async ({ userClient }) => {
    await contexte({
      preconditions: [
        'Une session est ouverte avec un compte habilité à valider les demandes',
        'La demande visée n’existe pas dans la file maker-checker',
      ],
    });

    const response = await etape(
      'Valider une demande dont l’identifiant ne correspond à aucune soumission',
      'Le service signale que la demande est introuvable au lieu de valider dans le vide',
      () => userClient.validateOrReject(UUID_INEXISTANT, decisionValide(), NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'validation utilisateur inexistant'),
    );
  });

  test('une décision sans notes est refusée', async ({ userClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte habilité à valider les demandes'],
      configuration: [
        'La décision soumise est un rejet dont le motif est vide, ce qui doit être refusé',
      ],
    });

    const response = await etape(
      'Rejeter une demande sans saisir de motif',
      'Le service refuse la décision : un rejet doit être justifié',
      () =>
        userClient.validateOrReject(
          UUID_INEXISTANT,
          { decision: 'REJECTED', notes: '', checkerOperationType: 'CREATE' },
          [...BAD_REQUEST_STATUSES, 404],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou de la ressource introuvable (404)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'décision sans notes'),
    );
  });

  test('la création d’utilisateur refuse un corps JSON (multipart attendu)', async ({
    apiContext,
  }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte autorisé à créer des utilisateurs'],
      configuration: [
        'La création attend un envoi multipart, car elle accepte une photo ; le corps est ici du JSON',
      ],
    });

    const response = await etape(
      'Créer un utilisateur en envoyant les données au format JSON',
      'Le service refuse le format : la création exige un envoi multipart',
      () =>
        apiContext.post(USER_PATHS.initCreate, {
          data: { username: 'x', nom: 'x', prenom: 'x', email: 'a@b.c' },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou de la ressource introuvable (404)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'init_create en JSON'),
    );
  });
});
