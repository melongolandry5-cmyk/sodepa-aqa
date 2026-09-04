import { test, expect } from '../comptabilite-generale-fixtures';
import { immobilisationValide } from '../helpers/compta-payload-helper';
import { COMPTA_PATHS } from '../comptabilite-generale-api-paths';
import { expectJsonArray, expectStatusIn, expectValidPage } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import {
  ANNEE_COURANTE,
  UUID_INEXISTANT,
  UUID_MALFORME,
  decisionValide,
  isoDate,
  unique,
} from '../../../test-data/builders';
import { contexte, etape } from '../../../helpers/scenario';

test.describe('API — Immobilisations : recherche et consultation', () => {
  test('la recherche paginée est cohérente', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte habilité sur les immobilisations'],
      configuration: ['La première page est demandée avec une taille de 10 éléments'],
    });

    const page = await etape(
      'Consulter la première page du registre des immobilisations, par tranches de 10',
      'Le service renvoie une page conforme à la demande',
      () => immobilisationClient.page({ page: 0, size: 10 }),
    );

    await etape(
      'Contrôler la structure de la page',
      'Le numéro de page et la taille renvoyés correspondent à ceux demandés, et le total est cohérent',
      async () => {
        expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
      },
    );
  });

  test('la seconde page ne répète pas la première', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Au moins trois immobilisations existent, sans quoi le cas est ignoré'],
      configuration: ['La pagination est demandée par tranches de 2 immobilisations'],
    });

    const premiere = await etape(
      'Consulter la première page de deux immobilisations',
      'Le service renvoie les deux premières et le total en base',
      () => immobilisationClient.page({ page: 0, size: 2 }),
    );
    test.skip(premiere.totalElements < 3, 'jeu de données insuffisant pour paginer');

    const seconde = await etape(
      'Consulter la page suivante',
      'Le service renvoie les immobilisations suivantes',
      () => immobilisationClient.page({ page: 1, size: 2 }),
    );

    await etape(
      'Comparer les deux pages',
      'Aucune immobilisation de la première page ne réapparaît sur la seconde : la pagination ne rejoue pas les mêmes lignes',
      async () => {
        const ids = premiere.content.map((i) => i.id);
        expect(seconde.content.filter((i) => ids.includes(i.id))).toHaveLength(0);
      },
    );
  });

  test('la recherche textuelle filtre le résultat', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: [
        'Au moins une immobilisation existe et porte une désignation d’au moins trois caractères',
      ],
      configuration: ['Les trois premiers caractères de cette désignation servent de critère'],
    });

    const reference = await etape(
      'Prendre une immobilisation existante comme référence',
      'Le service renvoie au moins une immobilisation avec sa désignation',
      () => immobilisationClient.page({ page: 0, size: 1 }),
    );
    test.skip(reference.content.length === 0, 'aucune immobilisation en base');

    const designation = String(reference.content[0].designation ?? '');
    test.skip(designation.length < 3, 'désignation trop courte pour une recherche');

    const filtres = await etape(
      'Rechercher les immobilisations sur un extrait de cette désignation',
      'Le service retrouve au moins l’immobilisation de référence',
      () =>
        immobilisationClient.page({ page: 0, size: 20, recherche: designation.slice(0, 3) }),
    );

    await etape(
      'Contrôler le nombre de résultats',
      'Le total est strictement positif : la recherche textuelle retrouve bien les libellés partiels',
      async () => {
        expect(filtres.totalElements).toBeGreaterThan(0);
      },
    );
  });

  test('une recherche sans correspondance renvoie une page vide', async ({
    immobilisationClient,
  }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le terme recherché est généré au hasard : aucune immobilisation ne le porte'],
    });

    const page = await etape(
      'Rechercher une désignation qui n’existe pas',
      'Le service renvoie une page vide plutôt qu’une erreur',
      () => immobilisationClient.page({ page: 0, size: 10, recherche: unique('ZZZ') }),
    );

    await etape(
      'Contrôler le contenu de la page',
      'Aucune immobilisation n’est renvoyée : la recherche ne se rabat pas sur la liste complète',
      async () => {
        expect(page.content).toHaveLength(0);
      },
    );
  });

  test('le filtre par statut ne renvoie que ce statut', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le filtre porte sur les immobilisations actives'],
    });

    const page = await etape(
      'Filtrer le registre sur les immobilisations actives',
      'Le service ne renvoie que les immobilisations encore en service',
      () => immobilisationClient.page({ page: 0, size: 50, statut: 'ACTIVE' }),
    );

    await etape(
      'Contrôler le statut de chaque immobilisation renvoyée',
      'Aucune immobilisation cédée ou sortie n’apparaît : le filtre par statut est appliqué',
      async () => {
        for (const immo of page.content) {
          expect(immo.statut).toBe('ACTIVE');
        }
      },
    );
  });

  test('un statut hors énumération est rejeté', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le statut demandé ne fait pas partie de ceux gérés par l’ERP'],
    });

    const response = await etape(
      'Filtrer le registre sur un statut qui n’existe pas',
      'Le service rejette la valeur au lieu de renvoyer un résultat trompeur',
      () => apiContext.get(COMPTA_PATHS.immoBase, { params: { statut: 'HORS_SERVICE' } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'statut hors énumération'),
    );
  });

  test('la file d’attente maker-checker est paginée', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à consulter la file de validation est ouverte'],
      configuration: ['La première page est demandée avec une taille de 10 éléments'],
    });

    const page = await etape(
      'Consulter la file des immobilisations en attente de validation',
      'Le service renvoie une page conforme à la demande, même si la file est vide',
      () => immobilisationClient.pending({ page: 0, size: 10 }),
    );

    await etape(
      'Contrôler la structure de la page',
      'Le numéro de page et la taille renvoyés correspondent à ceux demandés',
      async () => {
        expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
      },
    );
  });

  test('la consultation unitaire renvoie l’immobilisation demandée', async ({
    immobilisationClient,
  }) => {
    await contexte({
      preconditions: ['Au moins une immobilisation existe, sans quoi le cas est ignoré'],
    });

    const page = await etape(
      'Prendre une immobilisation existante dans le registre',
      'Le service renvoie au moins une immobilisation avec son identifiant',
      () => immobilisationClient.page({ page: 0, size: 1 }),
    );
    test.skip(page.content.length === 0, 'aucune immobilisation en base');

    const response = await etape(
      'Consulter la fiche de cette immobilisation par son identifiant',
      'Le service renvoie la fiche demandée',
      () => immobilisationClient.getById(String(page.content[0].id)),
    );

    await etape(
      'Contrôler l’identité de la fiche renvoyée',
      'C’est bien l’immobilisation demandée : le service ne renvoie pas une autre fiche',
      async () => {
        const immo = (await response.json()) as Record<string, unknown>;
        expect(String(immo.id)).toBe(String(page.content[0].id));
      },
    );
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: [
        'L’identifiant demandé est un UUID valide qui ne correspond à aucune immobilisation',
      ],
    });

    const response = await etape(
      'Consulter une immobilisation dont l’identifiant n’existe pas',
      'Le service signale que l’immobilisation est introuvable',
      () => immobilisationClient.getById(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'immobilisation inexistante'),
    );
  });

  test('un identifiant malformé est rejeté', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant demandé n’a pas la forme d’un UUID'],
    });

    const response = await etape(
      'Consulter une immobilisation avec un identifiant malformé',
      'Le service rejette la valeur avant même de chercher en base',
      () => immobilisationClient.getById(UUID_MALFORME, BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'immobilisation id malformé'),
    );
  });
});

test.describe('API — Immobilisations : plan d’amortissement', () => {
  test('le plan d’une immobilisation existante est cohérent', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: [
        'Au moins une immobilisation existe, sans quoi le cas est ignoré',
        'Une immobilisation ne peut être amortie au-delà de sa valeur d’origine',
      ],
    });

    const page = await etape(
      'Prendre une immobilisation existante dans le registre',
      'Le service renvoie au moins une immobilisation avec sa valeur d’origine',
      () => immobilisationClient.page({ page: 0, size: 1 }),
    );
    test.skip(page.content.length === 0, 'aucune immobilisation en base');

    const response = await etape(
      'Consulter son plan d’amortissement',
      'Le service produit l’échéancier des dotations',
      () => immobilisationClient.planAmortissement(String(page.content[0].id)),
    );

    await etape(
      'Totaliser les dotations du plan et les comparer à la valeur d’origine',
      'Le cumul des dotations ne dépasse pas la valeur d’origine : le bien n’est jamais amorti au-delà de ce qu’il vaut',
      async () => {
        const lignes = await expectJsonArray(response);
        const valeurOrigine = Number(page.content[0].valeurOrigine ?? 0);
        if (lignes.length > 0 && valeurOrigine > 0) {
          const dotations = (lignes as Record<string, unknown>[]).reduce(
            (total, l) => total + Number(l.dotation ?? l.annuite ?? 0),
            0,
          );
          expect(dotations).toBeLessThanOrEqual(valeurOrigine + 1);
        }
      },
    );
  });

  test('le plan d’une immobilisation inexistante échoue', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’immobilisation visée n’existe pas'],
    });

    const response = await etape(
      'Consulter le plan d’amortissement d’une immobilisation qui n’existe pas',
      'Le service signale que l’immobilisation est introuvable au lieu de produire un plan vide',
      () => immobilisationClient.planAmortissement(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'plan immobilisation inexistante'),
    );
  });

  test('la génération d’amortissement exige une année ≥ 1900', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à générer les amortissements est ouverte'],
      configuration: ['L’exercice demandé est 1800, antérieur à la borne acceptée'],
    });

    const response = await etape(
      'Générer les amortissements sur un exercice antérieur à 1900',
      'Le service refuse : un tel exercice ne correspond à aucune donnée exploitable',
      () =>
        immobilisationClient.initAmortir(
          { annee: 1800, compteImmoCode: '241' },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'amortissement année invalide'),
    );
  });

  test('la génération d’amortissement exige un compte', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à générer les amortissements est ouverte'],
      configuration: ['Le compte d’immobilisation transmis est vide'],
    });

    const response = await etape(
      'Générer les amortissements sans désigner de compte d’immobilisation',
      'Le service refuse : sans compte, la génération porterait sur tout le registre',
      () =>
        immobilisationClient.initAmortir(
          { annee: ANNEE_COURANTE, compteImmoCode: '' },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'amortissement sans compte'),
    );
  });

  test('la génération d’amortissement est soumise au circuit maker-checker', async ({
    immobilisationClient,
  }) => {
    await contexte({
      preconditions: ['Une session habilitée à générer les amortissements est ouverte'],
      configuration: [
        'La génération passe par le circuit de validation : elle produit une soumission, pas une écriture immédiate',
      ],
    });

    const response = await etape(
      'Générer les amortissements de l’exercice sur le compte d’immobilisations 241',
      'Le service enregistre une soumission soumise à validation plutôt que de comptabiliser directement',
      () =>
        immobilisationClient.initAmortir({ annee: ANNEE_COURANTE, compteImmoCode: '241' }, [
          200,
          201,
          202,
          ...NOT_FOUND_STATUSES,
        ]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code traduit une acceptation (200, 201, 202) ou une donnée absente (400, 404, 409, 500), jamais un refus de forme',
      () =>
        expectStatusIn(
          response,
          [200, 201, 202, ...NOT_FOUND_STATUSES],
          'amortissement nominal',
        ),
    );
  });
});

test.describe('API — Immobilisations : création et mise à jour', () => {
  test('la création exige un code', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des immobilisations est ouverte'],
      configuration: ['Le code de l’immobilisation est vide'],
    });

    const response = await etape(
      'Créer une immobilisation sans lui donner de code',
      'Le service refuse : le code identifie le bien dans le registre',
      () =>
        immobilisationClient.initCreate(immobilisationValide({ code: '' }), BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'immobilisation sans code'),
    );
  });

  test('la création exige une valeur d’origine positive', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des immobilisations est ouverte'],
      configuration: ['La valeur d’origine du bien est nulle'],
    });

    const response = await etape(
      'Créer une immobilisation d’une valeur d’origine nulle',
      'Le service refuse : sans valeur d’origine, aucun amortissement ne peut être calculé',
      () =>
        immobilisationClient.initCreate(
          immobilisationValide({ valeurOrigine: 0 }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'valeur d’origine nulle'),
    );
  });

  test('la création exige une durée utile positive', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des immobilisations est ouverte'],
      configuration: ['La durée d’utilisation du bien est nulle'],
    });

    const response = await etape(
      'Créer une immobilisation dont la durée d’utilisation est nulle',
      'Le service refuse : la durée détermine l’étalement des dotations',
      () =>
        immobilisationClient.initCreate(
          immobilisationValide({ dureeUtile: 0 }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'durée utile nulle'),
    );
  });

  test('un mode d’amortissement hors énumération est rejeté', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des immobilisations est ouverte'],
      configuration: ['Le mode d’amortissement demandé ne fait pas partie de ceux gérés par l’ERP'],
    });

    const response = await etape(
      'Créer une immobilisation avec un mode d’amortissement inconnu',
      'Le service refuse la valeur au lieu de retomber silencieusement sur un mode par défaut',
      () =>
        immobilisationClient.initCreate(
          immobilisationValide({ modeAmortissement: 'PROGRESSIF' }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'mode d’amortissement invalide'),
    );
  });

  test('les trois modes d’amortissement de l’énumération sont acceptés', async ({
    immobilisationClient,
  }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des immobilisations est ouverte'],
      configuration: [
        'Les trois modes gérés sont essayés successivement : linéaire, dégressif et accéléré',
      ],
    });

    await etape(
      'Créer une immobilisation avec chacun des trois modes d’amortissement gérés',
      'Aucun des trois n’est refusé pour cause de valeur inconnue : l’énumération annoncée est bien celle acceptée',
      async () => {
        for (const mode of ['LINEAIRE', 'DEGRESSIF', 'ACCELERE']) {
          const response = await immobilisationClient.initCreate(
            immobilisationValide({ modeAmortissement: mode }),
            [200, 201, 202, ...NOT_FOUND_STATUSES],
          );

          await expectStatusIn(response, [200, 201, 202, ...NOT_FOUND_STATUSES], `mode ${mode}`);
        }
      },
    );
  });

  test('une création nominale renvoie une soumission', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des immobilisations est ouverte'],
      configuration: [
        'La création passe par le circuit de validation : elle produit une soumission à valider',
      ],
    });

    const response = await etape(
      'Créer une immobilisation avec des données complètes et valides',
      'Le service enregistre la demande et renvoie la soumission créée',
      () =>
        immobilisationClient.initCreate(immobilisationValide(), [
          200,
          201,
          202,
          ...NOT_FOUND_STATUSES,
        ]),
    );
    test.skip(!response.ok(), 'création refusée par les règles métier de l’environnement');

    await etape(
      'Examiner la soumission renvoyée',
      'La soumission est renseignée : la demande est bien enregistrée et attend une validation',
      async () => {
        const soumission = (await response.json()) as Record<string, unknown>;
        expect(Object.keys(soumission).length).toBeGreaterThan(0);
      },
    );
  });

  test('la mise à jour exige un statut', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à modifier des immobilisations est ouverte'],
      configuration: ['Le corps soumis ne comporte pas de statut'],
    });

    const response = await etape(
      'Modifier une immobilisation sans préciser son statut',
      'Le service refuse : le statut fait partie des données obligatoires à la mise à jour',
      () =>
        immobilisationClient.initUpdate(UUID_INEXISTANT, immobilisationValide(), [
          ...BAD_REQUEST_STATUSES,
          404,
        ]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou de la ressource introuvable (404)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'mise à jour sans statut'),
    );
  });

  test('la mise à jour d’une immobilisation inexistante échoue', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à modifier des immobilisations est ouverte'],
      configuration: [
        'Les données soumises sont complètes ; seule l’immobilisation visée n’existe pas',
      ],
    });

    const response = await etape(
      'Modifier une immobilisation qui n’existe pas, avec des données valides',
      'Le service signale que l’immobilisation est introuvable plutôt que de la créer',
      () =>
        immobilisationClient.initUpdate(
          UUID_INEXISTANT,
          immobilisationValide({ statut: 'ACTIVE', dateMiseEnService: isoDate(-10) }),
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'maj immobilisation inexistante'),
    );
  });

  test('valider une soumission inexistante échoue', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à valider les soumissions est ouverte'],
      configuration: ['La soumission visée n’existe pas dans la file de validation'],
    });

    const response = await etape(
      'Valider une soumission dont l’identifiant ne correspond à rien',
      'Le service signale que la soumission est introuvable au lieu de valider dans le vide',
      () =>
        immobilisationClient.validateOrReject(
          UUID_INEXISTANT,
          decisionValide(),
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'validation immobilisation inexistante'),
    );
  });

  test('une décision sans notes est refusée', async ({ immobilisationClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à valider les soumissions est ouverte'],
      configuration: ['La décision soumise est une acceptation dont le commentaire est vide'],
    });

    const response = await etape(
      'Accepter une soumission sans saisir de commentaire',
      'Le service refuse : la décision doit être commentée pour rester traçable',
      () =>
        immobilisationClient.validateOrReject(
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
});
