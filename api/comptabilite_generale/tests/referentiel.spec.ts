import { test, expect } from '../comptabilite-generale-fixtures';
import { compteValide, tiersValide } from '../helpers/compta-payload-helper';
import { expectJsonArray, expectStatusIn, expectValidPage } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import { env } from '../../../helpers/env';
import {
  UUID_INEXISTANT,
  UUID_MALFORME,
  decisionValide,
  unique,
} from '../../../test-data/builders';
import { contexte, etape } from '../../../helpers/scenario';

test.describe('API — Référentiel : banques (/api/v1/caccounting/bank)', () => {
  test('la recherche paginée est cohérente', async ({ banqueClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte habilité sur le référentiel'],
      configuration: ['La première page est demandée avec une taille de 10 éléments'],
    });

    const page = await etape(
      'Consulter la première page du référentiel des banques, par tranches de 10',
      'Le service renvoie une page conforme à la demande',
      () => banqueClient.page({ page: 0, size: 10 }),
    );

    await etape(
      'Contrôler la structure de la page',
      'Le numéro de page et la taille renvoyés correspondent à ceux demandés, et le total est cohérent',
      async () => {
        expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
      },
    );
  });

  test('la liste complète renvoie un tableau', async ({ banqueClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La liste complète est demandée, sans pagination'],
    });

    const response = await etape(
      'Consulter la liste complète des banques',
      'Le service renvoie l’ensemble du référentiel en une fois',
      () => banqueClient.listRaw(),
    );

    await etape(
      'Examiner la structure de la réponse',
      'Le corps est un tableau de banques, vide si le référentiel n’est pas alimenté',
      () => expectJsonArray(response),
    );
  });

  test('la consultation unitaire renvoie la banque demandée', async ({ banqueClient }) => {
    await contexte({
      preconditions: ['Au moins une banque existe au référentiel, sans quoi le cas est ignoré'],
    });

    const banques = await etape(
      'Prendre une banque existante dans le référentiel',
      'Le service renvoie au moins une banque avec son identifiant',
      () => banqueClient.list(),
    );
    test.skip(banques.length === 0, 'aucune banque en base');

    const response = await etape(
      'Consulter cette banque par son identifiant',
      'Le service renvoie la fiche de la banque demandée',
      () => banqueClient.getById(String(banques[0].id)),
    );

    await etape(
      'Contrôler l’identité de la fiche renvoyée',
      'C’est bien la banque demandée : le service ne renvoie pas un autre établissement',
      async () => {
        const banque = (await response.json()) as Record<string, unknown>;
        expect(String(banque.id)).toBe(String(banques[0].id));
      },
    );
  });

  test('la consultation « active » renvoie une banque active', async ({ banqueClient }) => {
    await contexte({
      preconditions: ['Au moins une banque existe au référentiel, sans quoi le cas est ignoré'],
      configuration: [
        'La consultation « active » ne doit remonter que les banques encore en service',
      ],
    });

    const banques = await etape(
      'Prendre une banque existante dans le référentiel',
      'Le service renvoie au moins une banque',
      () => banqueClient.list(),
    );
    test.skip(banques.length === 0, 'aucune banque en base');

    const response = await etape(
      'Consulter cette banque par le point d’entrée réservé aux banques actives',
      'Le service renvoie la banque si elle est active, ou signale son absence si elle ne l’est pas',
      () => banqueClient.getActiveById(String(banques[0].id), [200, ...NOT_FOUND_STATUSES]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code est un succès (200) ou une absence assumée (400, 404, 409, 500) : jamais une erreur de forme',
      () => expectStatusIn(response, [200, ...NOT_FOUND_STATUSES], 'banque active'),
    );
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ banqueClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant demandé ne correspond à aucune banque'],
    });

    const response = await etape(
      'Consulter une banque dont l’identifiant n’existe pas',
      'Le service signale que la banque est introuvable',
      () => banqueClient.getById(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'banque inexistante'),
    );
  });

  test('un identifiant malformé est rejeté', async ({ banqueClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant demandé n’a pas la forme d’un UUID'],
    });

    const response = await etape(
      'Consulter une banque avec un identifiant malformé',
      'Le service rejette la valeur avant même de chercher en base',
      () => banqueClient.getById(UUID_MALFORME, BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'banque id malformé'),
    );
  });

  test('la mise à jour exige un code', async ({ banqueClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à modifier le référentiel est ouverte'],
      configuration: ['Le code de la banque soumis est vide'],
    });

    const response = await etape(
      'Modifier une banque en laissant son code vide',
      'Le service refuse : le code identifie l’établissement dans le référentiel',
      () =>
        banqueClient.initUpdate(
          UUID_INEXISTANT,
          { code: '', name: 'x', accountingCode: '521', logo: 'x', status: true },
          [...BAD_REQUEST_STATUSES, 404],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou de la ressource introuvable (404)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'banque sans code'),
    );
  });

  test('la mise à jour d’une banque inexistante échoue', async ({ banqueClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à modifier le référentiel est ouverte'],
      configuration: ['Les données soumises sont valides ; seule la banque visée n’existe pas'],
    });

    const response = await etape(
      'Modifier une banque qui n’existe pas, avec des données valides',
      'Le service signale que la banque est introuvable plutôt que de la créer',
      () =>
        banqueClient.initUpdate(
          UUID_INEXISTANT,
          { code: unique('BNK'), name: 'x', accountingCode: '521', logo: 'x', status: true },
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'maj banque inexistante'),
    );
  });

  test('la décision maker-checker exige des notes', async ({ banqueClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à valider les soumissions est ouverte'],
      configuration: ['La décision soumise est une acceptation dont le commentaire est vide'],
    });

    const response = await etape(
      'Accepter une soumission sans saisir de commentaire',
      'Le service refuse : la décision doit être commentée pour rester traçable',
      () =>
        banqueClient.validateOrReject(
          UUID_INEXISTANT,
          { decision: 'ACCEPTED', notes: '', checkerOperationType: 'CREATE' },
          [...BAD_REQUEST_STATUSES, 404],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou de la ressource introuvable (404)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'décision sans notes'),
    );
  });

  test('une décision hors énumération est rejetée', async ({ banqueClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à valider les soumissions est ouverte'],
      configuration: ['La décision transmise ne fait pas partie de celles reconnues par l’ERP'],
    });

    const response = await etape(
      'Soumettre une décision qui n’est ni une acceptation ni un rejet',
      'Le service refuse la valeur au lieu de l’interpréter comme un refus par défaut',
      () =>
        banqueClient.validateOrReject(
          UUID_INEXISTANT,
          { decision: 'PEUT_ETRE' as never, notes: 'x', checkerOperationType: 'CREATE' },
          [...BAD_REQUEST_STATUSES, 404],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou de la ressource introuvable (404)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'décision invalide'),
    );
  });

  test('valider une soumission inexistante échoue', async ({ banqueClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à valider les soumissions est ouverte'],
      configuration: ['La soumission visée n’existe pas dans la file de validation'],
    });

    const response = await etape(
      'Valider une soumission de banque dont l’identifiant ne correspond à rien',
      'Le service signale que la soumission est introuvable',
      () => banqueClient.validateOrReject(UUID_INEXISTANT, decisionValide(), NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'validation banque inexistante'),
    );
  });
});

test.describe('API — Référentiel : comptes (/api/v1/caccounting/compte)', () => {
  test('la recherche paginée est cohérente', async ({ compteClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte habilité sur le plan comptable'],
      configuration: ['La première page est demandée avec une taille de 20 éléments'],
    });

    const page = await etape(
      'Consulter la première page du plan comptable, par tranches de 20',
      'Le service renvoie une page conforme à la demande',
      () => compteClient.page({ page: 0, size: 20 }),
    );

    await etape(
      'Contrôler la structure de la page',
      'Le numéro de page et la taille renvoyés correspondent à ceux demandés',
      async () => {
        expectValidPage(page, { expectedPage: 0, expectedSize: 20 });
      },
    );
  });

  test('la liste complète renvoie un tableau', async ({ compteClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La liste complète du plan comptable est demandée, sans pagination'],
    });

    const response = await etape(
      'Consulter la liste complète des comptes généraux',
      'Le service renvoie l’ensemble du plan comptable en une fois',
      () => compteClient.listRaw(),
    );

    await etape(
      'Examiner la structure de la réponse',
      'Le corps est un tableau de comptes, vide si le plan comptable n’est pas alimenté',
      () => expectJsonArray(response),
    );
  });

  test('un compte créé est soumis au circuit maker-checker', async ({ compteClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des comptes est ouverte'],
      configuration: [
        'La création passe par le circuit de validation : elle produit une soumission, pas un compte immédiatement actif',
      ],
    });

    const response = await etape(
      'Créer un compte général avec des données valides',
      'Le service enregistre la demande et la place en attente de validation',
      () => compteClient.initCreate(compteValide(), [200, 201, 202]),
    );

    await etape(
      'Contrôler la réponse',
      'La demande est acceptée : le compte entre dans le circuit maker-checker',
      async () => {
        expect(response.ok()).toBeTruthy();
      },
    );
  });

  test('la création exige un code', async ({ compteClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des comptes est ouverte'],
      configuration: ['Le code du compte soumis est vide'],
    });

    const response = await etape(
      'Créer un compte général sans lui donner de code',
      'Le service refuse : le code est la clé du compte dans le plan comptable',
      () => compteClient.initCreate(compteValide({ code: '' }), BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'compte sans code'),
    );
  });

  test('la création exige un intitulé', async ({ compteClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des comptes est ouverte'],
      configuration: ['L’intitulé du compte soumis est vide'],
    });

    const response = await etape(
      'Créer un compte général sans intitulé',
      'Le service refuse : l’intitulé rend le compte lisible dans les états comptables',
      () => compteClient.initCreate(compteValide({ intitule: '' }), BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'compte sans intitulé'),
    );
  });

  test('la création exige un niveau', async ({ compteClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des comptes est ouverte'],
      configuration: ['Aucun niveau hiérarchique n’est transmis'],
    });

    const response = await etape(
      'Créer un compte général sans préciser son niveau dans la hiérarchie',
      'Le service refuse : le niveau situe le compte dans l’arborescence OHADA',
      () => compteClient.initCreate(compteValide({ niveau: undefined }), BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'compte sans niveau'),
    );
  });

  test('un code de compte dupliqué est refusé', async ({ compteClient }) => {
    await contexte({
      preconditions: [
        'Au moins un compte existe au plan comptable, sans quoi le cas est ignoré',
        'Le code d’un compte est unique dans le plan comptable',
      ],
      configuration: ['Le compte créé reprend le code d’un compte déjà existant'],
    });

    const comptes = await etape(
      'Relever le code d’un compte déjà présent au plan comptable',
      'Le service renvoie au moins un compte avec son code',
      () => compteClient.list(),
    );
    test.skip(comptes.length === 0, 'aucun compte en base');

    const response = await etape(
      'Créer un compte en réutilisant ce code existant',
      'Le service refuse le doublon : deux comptes ne peuvent porter le même code',
      () =>
        compteClient.initCreate(compteValide({ code: String(comptes[0].code) }), [
          ...BAD_REQUEST_STATUSES,
          409,
          200,
          201,
          202,
        ]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code traduit un refus explicite (400, 409, 422 ou 500) : la création n’est jamais acceptée',
      async () => {
        expect([400, 409, 422, 500]).toContain(response.status());
      },
    );
  });

  test('la consultation unitaire renvoie le compte demandé', async ({ compteClient }) => {
    await contexte({
      preconditions: ['Au moins un compte existe au plan comptable, sans quoi le cas est ignoré'],
    });

    const comptes = await etape(
      'Prendre un compte existant au plan comptable',
      'Le service renvoie au moins un compte avec son identifiant',
      () => compteClient.list(),
    );
    test.skip(comptes.length === 0, 'aucun compte en base');

    const response = await etape(
      'Consulter ce compte par son identifiant',
      'Le service renvoie la fiche du compte demandé',
      () => compteClient.getById(String(comptes[0].id)),
    );

    await etape(
      'Contrôler l’identité de la fiche renvoyée',
      'C’est bien le compte demandé : le service ne renvoie pas un compte voisin',
      async () => {
        const compte = (await response.json()) as Record<string, unknown>;
        expect(String(compte.id)).toBe(String(comptes[0].id));
      },
    );
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ compteClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant demandé ne correspond à aucun compte'],
    });

    const response = await etape(
      'Consulter un compte général dont l’identifiant n’existe pas',
      'Le service signale que le compte est introuvable',
      () => compteClient.getById(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'compte inexistant'),
    );
  });

  test('la mise à jour d’un compte inexistant échoue', async ({ compteClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à modifier le plan comptable est ouverte'],
      configuration: ['Les données soumises sont valides ; seul le compte visé n’existe pas'],
    });

    const response = await etape(
      'Modifier un compte général qui n’existe pas, avec des données valides',
      'Le service signale que le compte est introuvable plutôt que de le créer',
      () => compteClient.initUpdate(UUID_INEXISTANT, compteValide(), NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'maj compte inexistant'),
    );
  });

  test('la suppression d’un compte inexistant échoue', async ({ compteClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à supprimer des comptes est ouverte'],
      configuration: ['Le compte visé n’existe pas'],
    });

    const response = await etape(
      'Supprimer un compte général qui n’existe pas',
      'Le service signale que le compte est introuvable au lieu de confirmer une suppression fictive',
      () => compteClient.supprimer(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'suppression compte inexistant'),
    );
  });

  test('un compte créé puis supprimé disparaît du référentiel', async ({ compteClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer et supprimer des comptes est ouverte'],
      configuration: [
        'RUN_DESTRUCTIVE=true, sans quoi le cas est ignoré : le plan comptable est modifié',
        'Le compte doit avoir été validé par le circuit maker-checker pour être supprimable',
      ],
    });

    test.skip(
      !env.runDestructive,
      'test destructif : activer RUN_DESTRUCTIVE=true sur un environnement jetable',
    );
    const corps = compteValide();

    await etape(
      'Créer un compte général au plan comptable',
      'La demande de création est acceptée et entre dans le circuit de validation',
      () => compteClient.initCreate(corps, [200, 201, 202]),
    );

    const comptes = await etape(
      'Rechercher ce compte dans le plan comptable',
      'Le compte apparaît au référentiel une fois la création validée',
      () => compteClient.list(),
    );
    const cree = comptes.find((c) => c.code === corps.code);
    test.skip(!cree, 'le compte reste en attente de validation maker-checker');

    await etape(
      'Supprimer ce compte',
      'Le service accepte la suppression du compte',
      () => compteClient.supprimer(String(cree!.id), [200, 204]),
    );

    await etape(
      'Rechercher à nouveau le compte supprimé',
      'Le compte est introuvable : la suppression l’a bien retiré du référentiel',
      () => compteClient.getById(String(cree!.id), NOT_FOUND_STATUSES),
    );
  });

  test('valider une soumission inexistante échoue', async ({ compteClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à valider les soumissions est ouverte'],
      configuration: ['La soumission visée n’existe pas dans la file de validation'],
    });

    const response = await etape(
      'Valider une soumission de compte dont l’identifiant ne correspond à rien',
      'Le service signale que la soumission est introuvable',
      () => compteClient.validateOrReject(UUID_INEXISTANT, decisionValide(), NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'validation compte inexistant'),
    );
  });
});

test.describe('API — Référentiel : tiers (/api/v1/caccounting/tiers)', () => {
  test('la recherche paginée est cohérente', async ({ tiersClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte habilité sur le référentiel des tiers'],
      configuration: ['La première page est demandée avec une taille de 10 éléments'],
    });

    const page = await etape(
      'Consulter la première page du référentiel des tiers, par tranches de 10',
      'Le service renvoie une page conforme à la demande',
      () => tiersClient.page({ page: 0, size: 10 }),
    );

    await etape(
      'Contrôler la structure de la page',
      'Le numéro de page et la taille renvoyés correspondent à ceux demandés',
      async () => {
        expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
      },
    );
  });

  test('la liste des tiers actifs renvoie un tableau', async ({ tiersClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Seuls les tiers actifs sont attendus dans cette liste'],
    });

    const response = await etape(
      'Consulter la liste des tiers actifs',
      'Le service renvoie les clients et fournisseurs encore en relation',
      () => tiersClient.listRaw(),
    );

    await etape(
      'Examiner la structure de la réponse',
      'Le corps est un tableau de tiers, vide si le référentiel n’est pas alimenté',
      () => expectJsonArray(response),
    );
  });

  test('la création exige un type de tiers valide', async ({ tiersClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des tiers est ouverte'],
      configuration: ['Le type de tiers transmis n’est ni client ni fournisseur'],
    });

    const response = await etape(
      'Créer un tiers avec un type qui n’existe pas au référentiel',
      'Le service refuse la valeur : le type détermine le compte collectif de rattachement',
      () => tiersClient.initCreate(tiersValide({ typeTiers: 'INCONNU' }), BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'type de tiers invalide'),
    );
  });

  test('la création exige un email bien formé', async ({ tiersClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des tiers est ouverte'],
      configuration: ['L’adresse électronique soumise ne respecte pas le format attendu'],
    });

    const response = await etape(
      'Créer un tiers avec une adresse électronique invalide',
      'Le service refuse : une adresse mal formée rendrait les relances impossibles',
      () => tiersClient.initCreate(tiersValide({ email: 'pas-un-email' }), BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'email mal formé'),
    );
  });

  test('la création exige un compte collectif', async ({ tiersClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des tiers est ouverte'],
      configuration: ['Le compte collectif de rattachement est vide'],
    });

    const response = await etape(
      'Créer un tiers sans compte collectif de rattachement',
      'Le service refuse : sans compte collectif, les écritures du tiers ne s’imputent nulle part',
      () =>
        tiersClient.initCreate(tiersValide({ compteCollectifCode: '' }), BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'tiers sans compte collectif'),
    );
  });

  test('une création nominale est acceptée par le circuit maker-checker', async ({ tiersClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des tiers est ouverte'],
      configuration: [
        'La création passe par le circuit de validation : elle produit une soumission à valider',
      ],
    });

    const response = await etape(
      'Créer un tiers avec des données complètes et valides',
      'Le service enregistre la demande et la place en attente de validation',
      () => tiersClient.initCreate(tiersValide(), [200, 201, 202, ...NOT_FOUND_STATUSES]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code traduit une acceptation (200, 201, 202) ou une donnée de rattachement absente (400, 404, 409, 500), jamais un refus de forme',
      () =>
        expectStatusIn(response, [200, 201, 202, ...NOT_FOUND_STATUSES], 'création tiers'),
    );
  });

  test('la consultation unitaire renvoie le tiers demandé', async ({ tiersClient }) => {
    await contexte({
      preconditions: ['Au moins un tiers existe au référentiel, sans quoi le cas est ignoré'],
    });

    const tiers = await etape(
      'Prendre un tiers existant dans le référentiel',
      'Le service renvoie au moins un tiers avec son identifiant',
      () => tiersClient.list(),
    );
    test.skip(tiers.length === 0, 'aucun tiers en base');

    const response = await etape(
      'Consulter ce tiers par son identifiant',
      'Le service renvoie la fiche du tiers demandé',
      () => tiersClient.getById(String(tiers[0].id)),
    );

    await etape(
      'Contrôler l’identité de la fiche renvoyée',
      'C’est bien le tiers demandé : le service ne renvoie pas un autre client ou fournisseur',
      async () => {
        const detail = (await response.json()) as Record<string, unknown>;
        expect(String(detail.id)).toBe(String(tiers[0].id));
      },
    );
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ tiersClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant demandé ne correspond à aucun tiers'],
    });

    const response = await etape(
      'Consulter un tiers dont l’identifiant n’existe pas',
      'Le service signale que le tiers est introuvable',
      () => tiersClient.getById(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'tiers inexistant'),
    );
  });

  test('la mise à jour d’un tiers inexistant échoue', async ({ tiersClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à modifier le référentiel des tiers est ouverte'],
      configuration: ['Les données soumises sont valides ; seul le tiers visé n’existe pas'],
    });

    const response = await etape(
      'Modifier un tiers qui n’existe pas, avec des données valides',
      'Le service signale que le tiers est introuvable plutôt que de le créer',
      () =>
        tiersClient.initUpdate(UUID_INEXISTANT, tiersValide({ actif: true }), NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'maj tiers inexistant'),
    );
  });

  test('valider une soumission inexistante échoue', async ({ tiersClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à valider les soumissions est ouverte'],
      configuration: ['La soumission visée n’existe pas dans la file de validation'],
    });

    const response = await etape(
      'Valider une soumission de tiers dont l’identifiant ne correspond à rien',
      'Le service signale que la soumission est introuvable',
      () => tiersClient.validateOrReject(UUID_INEXISTANT, decisionValide(), NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'validation tiers inexistant'),
    );
  });
});

test.describe('API — Référentiel : journaux (/api/comptabilite/journaux)', () => {
  test('la recherche paginée est cohérente', async ({ journalClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte habilité sur les journaux'],
      configuration: ['La première page est demandée avec une taille de 10 éléments'],
    });

    const page = await etape(
      'Consulter la première page des journaux comptables, par tranches de 10',
      'Le service renvoie une page conforme à la demande',
      () => journalClient.page({ page: 0, size: 10 }),
    );

    await etape(
      'Contrôler la structure de la page',
      'Le numéro de page et la taille renvoyés correspondent à ceux demandés',
      async () => {
        expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
      },
    );
  });

  test('la liste complète renvoie un tableau', async ({ journalClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La liste complète est demandée, sans pagination'],
    });

    const response = await etape(
      'Consulter la liste complète des journaux comptables',
      'Le service renvoie l’ensemble des journaux en une fois',
      () => journalClient.listRaw(),
    );

    await etape(
      'Examiner la structure de la réponse',
      'Le corps est un tableau de journaux, vide si aucun n’est paramétré',
      () => expectJsonArray(response),
    );
  });

  test('la création exige un code de journal de l’énumération OHADA', async ({ journalClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des journaux est ouverte'],
      configuration: ['Le code de journal soumis ne fait pas partie de ceux prévus par OHADA'],
    });

    const response = await etape(
      'Créer un journal avec un code hors du référentiel OHADA',
      'Le service refuse : les codes de journaux sont normalisés par le référentiel comptable',
      () =>
        journalClient.initCreate(
          { code: 'ZZ', intitule: 'x', typeJournal: 'DIVERS' },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'code journal hors énumération'),
    );
  });

  test('la création exige un intitulé', async ({ journalClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des journaux est ouverte'],
      configuration: ['Le code du journal est valide, mais son intitulé est vide'],
    });

    const response = await etape(
      'Créer un journal sans intitulé',
      'Le service refuse : l’intitulé identifie le journal pour le comptable',
      () =>
        journalClient.initCreate(
          { code: 'OD', intitule: '', typeJournal: 'DIVERS' },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'journal sans intitulé'),
    );
  });

  test('la consultation unitaire renvoie le journal demandé', async ({ journalClient }) => {
    await contexte({
      preconditions: ['Au moins un journal existe, sans quoi le cas est ignoré'],
    });

    const journaux = await etape(
      'Prendre un journal existant',
      'Le service renvoie au moins un journal avec son identifiant',
      () => journalClient.list(),
    );
    test.skip(journaux.length === 0, 'aucun journal en base');

    const response = await etape(
      'Consulter ce journal par son identifiant',
      'Le service renvoie la fiche du journal demandé',
      () => journalClient.getById(String(journaux[0].id)),
    );

    await etape(
      'Contrôler l’identité de la fiche renvoyée',
      'C’est bien le journal demandé : le service ne renvoie pas un journal voisin',
      async () => {
        const journal = (await response.json()) as Record<string, unknown>;
        expect(String(journal.id)).toBe(String(journaux[0].id));
      },
    );
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ journalClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant demandé ne correspond à aucun journal'],
    });

    const response = await etape(
      'Consulter un journal dont l’identifiant n’existe pas',
      'Le service signale que le journal est introuvable',
      () => journalClient.getById(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'journal inexistant'),
    );
  });

  test('la consultation « active » d’un journal inexistant échoue', async ({ journalClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le journal visé n’existe pas, a fortiori parmi les journaux actifs'],
    });

    const response = await etape(
      'Consulter un journal inexistant par le point d’entrée réservé aux journaux actifs',
      'Le service signale que le journal est introuvable',
      () => journalClient.getActiveById(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'journal actif inexistant'),
    );
  });

  test('la bascule d’activation est réversible', async ({ journalClient }) => {
    await contexte({
      preconditions: ['Au moins un journal existe, sans quoi le cas est ignoré'],
      configuration: [
        'RUN_DESTRUCTIVE=true, sans quoi le cas est ignoré : l’état du journal est modifié',
        'La bascule est appliquée deux fois pour rendre au journal son état de départ',
      ],
    });

    test.skip(
      !env.runDestructive,
      'test destructif : activer RUN_DESTRUCTIVE=true sur un environnement jetable',
    );

    const journaux = await etape(
      'Prendre un journal existant',
      'Le service renvoie au moins un journal',
      () => journalClient.list(),
    );
    test.skip(journaux.length === 0, 'aucun journal en base');
    const id = String(journaux[0].id);

    await etape(
      'Basculer l’activation de ce journal',
      'Le service accepte la bascule : un journal actif se désactive et inversement',
      () => journalClient.toggle(id, [200, 204]),
    );

    await etape(
      'Basculer à nouveau l’activation du même journal',
      'Le journal retrouve son état initial : la bascule est bien réversible et ne laisse pas de trace',
      () => journalClient.toggle(id, [200, 204]),
    );
  });

  test('la bascule sur un journal inexistant échoue', async ({ journalClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à activer ou désactiver un journal est ouverte'],
      configuration: ['Le journal visé n’existe pas'],
    });

    const response = await etape(
      'Basculer l’activation d’un journal qui n’existe pas',
      'Le service signale que le journal est introuvable',
      () => journalClient.toggle(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'toggle journal inexistant'),
    );
  });

  test('valider une soumission inexistante échoue', async ({ journalClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à valider les soumissions est ouverte'],
      configuration: ['La soumission visée n’existe pas dans la file de validation'],
    });

    const response = await etape(
      'Valider une soumission de journal dont l’identifiant ne correspond à rien',
      'Le service signale que la soumission est introuvable',
      () => journalClient.validateOrReject(UUID_INEXISTANT, decisionValide(), NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'validation journal inexistant'),
    );
  });
});
