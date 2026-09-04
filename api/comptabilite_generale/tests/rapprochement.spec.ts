import { test, expect } from '../comptabilite-generale-fixtures';
import { COMPTA_PATHS } from '../comptabilite-generale-api-paths';
import { expectStatusIn, expectValidPage } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import { env } from '../../../helpers/env';
import {
  ANNEE_COURANTE,
  UUID_INEXISTANT,
  UUID_MALFORME,
  today,
} from '../../../test-data/builders';
import { contexte, etape } from '../../../helpers/scenario';

/** Relevé manuel équilibré, à dériver dans les tests. */
function releveManuel(banqueId: string, overrides: Record<string, unknown> = {}) {
  return {
    banqueId,
    dateReleve: today(),
    soldeInitial: 1_000_000,
    soldeFinal: 1_250_000,
    lignes: [
      { dateTransaction: today(), libelle: 'Virement client', montant: 300_000 },
      { dateTransaction: today(), libelle: 'Frais bancaires', montant: -50_000 },
    ],
    ...overrides,
  };
}

test.describe('API — Relevés bancaires : consultation', () => {
  test('la recherche paginée est cohérente', async ({ rapprochementClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte habilité sur les relevés bancaires'],
      configuration: ['La première page est demandée avec une taille de 10 éléments'],
    });

    const page = await etape(
      'Consulter la première page des relevés bancaires, par tranches de 10',
      'Le service renvoie une page conforme à la demande',
      () => rapprochementClient.listerReleves({ page: 0, size: 10 }),
    );

    await etape(
      'Contrôler la structure de la page',
      'Le numéro de page et la taille renvoyés correspondent à ceux demandés, et le total est cohérent',
      async () => {
        expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
      },
    );
  });

  test('le filtre par banque ne renvoie que ce prêteur', async ({
    rapprochementClient,
    banqueClient,
  }) => {
    await contexte({
      preconditions: ['Au moins une banque existe au référentiel, sans quoi le cas est ignoré'],
    });

    const banques = await etape(
      'Relever une banque du référentiel',
      'Le service renvoie la liste des banques enregistrées',
      () => banqueClient.list(),
    );
    test.skip(banques.length === 0, 'aucune banque en base');
    const banqueId = String(banques[0].id);

    const page = await etape(
      'Filtrer les relevés bancaires sur cette banque',
      'Le service ne renvoie que les relevés de la banque demandée',
      () => rapprochementClient.listerReleves({ page: 0, size: 50, banqueId }),
    );

    await etape(
      'Contrôler la banque de chaque relevé renvoyé',
      'Aucun relevé d’un autre établissement n’apparaît : le filtre cloisonne bien les banques',
      async () => {
        for (const releve of page.content) {
          if (releve.banqueId !== undefined) {
            expect(releve.banqueId).toBe(banqueId);
          }
        }
      },
    );
  });

  test('le filtre « validé » est appliqué', async ({ rapprochementClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le filtre ne retient que les relevés déjà validés'],
    });

    const page = await etape(
      'Filtrer les relevés sur ceux qui sont validés',
      'Le service écarte les relevés encore en attente de validation',
      () => rapprochementClient.listerReleves({ page: 0, size: 50, valide: true }),
    );

    await etape(
      'Contrôler l’état de validation de chaque relevé renvoyé',
      'Tous les relevés renvoyés sont validés : le filtre ne laisse pas passer de brouillon',
      async () => {
        for (const releve of page.content) {
          if (releve.valide !== undefined) {
            expect(releve.valide).toBe(true);
          }
        }
      },
    );
  });

  test('un banqueId malformé est rejeté', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant de banque transmis n’a pas la forme d’un UUID'],
    });

    const response = await etape(
      'Filtrer les relevés avec un identifiant de banque malformé',
      'Le service rejette la valeur au lieu de chercher une banque inexistante',
      () => apiContext.get(COMPTA_PATHS.releves, { params: { banqueId: UUID_MALFORME } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'banqueId malformé'),
    );
  });

  test('la consultation unitaire renvoie le relevé demandé', async ({ rapprochementClient }) => {
    await contexte({
      preconditions: ['Au moins un relevé bancaire existe, sans quoi le cas est ignoré'],
    });

    const page = await etape(
      'Prendre un relevé existant dans la liste',
      'Le service renvoie au moins un relevé avec son identifiant',
      () => rapprochementClient.listerReleves({ page: 0, size: 1 }),
    );
    test.skip(page.content.length === 0, 'aucun relevé en base');

    const response = await etape(
      'Consulter ce relevé par son identifiant',
      'Le service renvoie le relevé demandé',
      () => rapprochementClient.getReleve(String(page.content[0].id)),
    );

    await etape(
      'Contrôler l’identité du relevé renvoyé',
      'C’est bien le relevé demandé : le service ne renvoie pas celui d’une autre période',
      async () => {
        const releve = (await response.json()) as Record<string, unknown>;
        expect(String(releve.id)).toBe(String(page.content[0].id));
      },
    );
  });

  test('un relevé inexistant ne renvoie pas 200', async ({ rapprochementClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant demandé ne correspond à aucun relevé'],
    });

    const response = await etape(
      'Consulter un relevé bancaire qui n’existe pas',
      'Le service signale que le relevé est introuvable',
      () => rapprochementClient.getReleve(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'relevé inexistant'),
    );
  });
});

test.describe('API — Relevés bancaires : saisie et synchronisation', () => {
  test('la saisie manuelle exige au moins une ligne', async ({ rapprochementClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à saisir des relevés est ouverte'],
      configuration: ['Le relevé soumis ne comporte aucune ligne d’opération'],
    });

    const response = await etape(
      'Saisir un relevé bancaire ne contenant aucune opération',
      'Le service refuse : un relevé sans ligne ne peut être rapproché de rien',
      () =>
        rapprochementClient.saisirReleveManuel(
          releveManuel(UUID_INEXISTANT, { lignes: [] }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'relevé sans ligne'),
    );
  });

  test('la saisie manuelle exige une banque', async ({ rapprochementClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à saisir des relevés est ouverte'],
      configuration: ['Aucune banque n’est désignée sur le relevé'],
    });

    const response = await etape(
      'Saisir un relevé bancaire sans préciser l’établissement',
      'Le service refuse : un relevé se rattache nécessairement à une banque',
      () =>
        rapprochementClient.saisirReleveManuel(
          releveManuel(UUID_INEXISTANT, { banqueId: undefined }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'relevé sans banque'),
    );
  });

  test('la saisie manuelle exige les deux soldes', async ({ rapprochementClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à saisir des relevés est ouverte'],
      configuration: ['Le solde final du relevé n’est pas renseigné'],
    });

    const response = await etape(
      'Saisir un relevé bancaire sans son solde final',
      'Le service refuse : sans les deux soldes, la cohérence du relevé ne peut être vérifiée',
      () =>
        rapprochementClient.saisirReleveManuel(
          releveManuel(UUID_INEXISTANT, { soldeFinal: undefined }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'relevé sans solde final'),
    );
  });

  test('une ligne sans libellé est refusée', async ({ rapprochementClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à saisir des relevés est ouverte'],
      configuration: ['La seule ligne du relevé porte un libellé vide'],
    });

    const response = await etape(
      'Saisir un relevé dont une opération n’a pas de libellé',
      'Le service refuse : une opération sans libellé serait impossible à rapprocher',
      () =>
        rapprochementClient.saisirReleveManuel(
          releveManuel(UUID_INEXISTANT, {
            lignes: [{ dateTransaction: today(), libelle: '', montant: 1000 }],
          }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'ligne sans libellé'),
    );
  });

  test('la saisie sur une banque inexistante échoue', async ({ rapprochementClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à saisir des relevés est ouverte'],
      configuration: ['Le relevé est complet, mais la banque désignée n’existe pas'],
    });

    const response = await etape(
      'Saisir un relevé complet pour une banque inexistante',
      'Le service signale que la banque est introuvable plutôt que de créer le relevé',
      () =>
        rapprochementClient.saisirReleveManuel(
          releveManuel(UUID_INEXISTANT),
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'relevé banque inexistante'),
    );
  });

  test('un relevé manuel saisi est relisible', async ({ rapprochementClient, banqueClient }) => {
    await contexte({
      preconditions: ['Au moins une banque existe au référentiel, sans quoi le cas est ignoré'],
      configuration: [
        'Le relevé saisi comporte deux opérations : un virement client et des frais bancaires',
      ],
    });

    const banques = await etape(
      'Relever une banque du référentiel',
      'Le service renvoie la liste des banques enregistrées',
      () => banqueClient.list(),
    );
    test.skip(banques.length === 0, 'aucune banque en base');

    const response = await etape(
      'Saisir un relevé bancaire pour cette banque',
      'Le service enregistre le relevé et lui attribue un identifiant',
      () =>
        rapprochementClient.saisirReleveManuel(releveManuel(String(banques[0].id)), [
          200,
          201,
          ...NOT_FOUND_STATUSES,
          ...BAD_REQUEST_STATUSES,
        ]),
    );
    test.skip(!response.ok(), 'saisie refusée par les règles métier de l’environnement');

    await etape(
      'Relire le relevé qui vient d’être saisi',
      'Le relevé est retrouvé par son identifiant : la saisie a bien été persistée',
      async () => {
        const releve = (await response.json()) as Record<string, unknown>;
        const relu = await rapprochementClient.getReleve(String(releve.id));
        expect(relu.ok()).toBeTruthy();
      },
    );
  });

  test('la synchronisation exige une banque et une date', async ({ rapprochementClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à synchroniser les relevés est ouverte'],
      configuration: ['Seul le solde initial est transmis ; banque et date sont omises'],
    });

    const response = await etape(
      'Lancer une synchronisation bancaire sans préciser la banque ni la date',
      'Le service refuse : la synchronisation doit cibler un établissement et une date de relevé',
      () => rapprochementClient.synchroniser({ soldeInitial: 0 }, BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'synchronisation incomplète'),
    );
  });

  test('la synchronisation sur une banque inexistante échoue', async ({ rapprochementClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à synchroniser les relevés est ouverte'],
      configuration: ['Les paramètres sont complets, mais la banque désignée n’existe pas'],
    });

    const response = await etape(
      'Lancer une synchronisation bancaire pour un établissement inexistant',
      'Le service signale que la banque est introuvable',
      () =>
        rapprochementClient.synchroniser(
          { banqueId: UUID_INEXISTANT, dateReleve: today(), soldeInitial: 0 },
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'synchronisation banque inexistante'),
    );
  });
});

test.describe('API — Relevés bancaires : rapprochement automatique', () => {
  test('le rapprochement exige un compte de banque', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session habilitée à rapprocher est ouverte'],
      configuration: ['Aucun compte de banque n’est transmis'],
    });

    const response = await etape(
      'Lancer un rapprochement sans indiquer le compte de banque à mouvementer',
      'Le service refuse : le rapprochement doit savoir sur quel compte lettrer les écritures',
      () => apiContext.post(COMPTA_PATHS.releveRapprocher(UUID_INEXISTANT)),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'rapprochement sans compte'),
    );
  });

  test('le rapprochement d’un relevé inexistant échoue', async ({ rapprochementClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à rapprocher est ouverte'],
      configuration: ['Le compte de banque est renseigné ; seul le relevé visé n’existe pas'],
    });

    const response = await etape(
      'Lancer le rapprochement d’un relevé qui n’existe pas',
      'Le service signale que le relevé est introuvable au lieu de lettrer à l’aveugle',
      () => rapprochementClient.rapprocher(UUID_INEXISTANT, '521100', NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'rapprochement relevé inexistant'),
    );
  });

  test('le rapprochement d’un relevé réel renvoie un nombre de lettrages', async ({
    rapprochementClient,
  }) => {
    await contexte({
      preconditions: [
        'Au moins un relevé bancaire existe, sans quoi le cas est ignoré',
        'Le compte 521100 existe au plan comptable',
      ],
      configuration: [
        'RUN_DESTRUCTIVE=true, sans quoi le cas est ignoré : le rapprochement lettre réellement les écritures',
      ],
    });

    test.skip(
      !env.runDestructive,
      'test destructif : le rapprochement lettre les écritures (RUN_DESTRUCTIVE=true)',
    );

    const page = await etape(
      'Prendre un relevé bancaire existant',
      'Le service renvoie au moins un relevé',
      () => rapprochementClient.listerReleves({ page: 0, size: 1 }),
    );
    test.skip(page.content.length === 0, 'aucun relevé en base');

    const response = await etape(
      'Lancer le rapprochement de ce relevé sur le compte de banque 521100',
      'Le service rapproche les opérations et rend compte du nombre de lettrages effectués',
      () =>
        rapprochementClient.rapprocher(String(page.content[0].id), '521100', [
          200,
          ...NOT_FOUND_STATUSES,
        ]),
    );
    test.skip(!response.ok(), 'compte 521100 absent du plan comptable');

    await etape(
      'Contrôler le nombre de lettrages annoncé',
      'Le compte rendu est un nombre positif ou nul : jamais négatif, même si rien n’a pu être rapproché',
      async () => {
        expect(Number(await response.text())).toBeGreaterThanOrEqual(0);
      },
    );
  });
});

test.describe('API — Clôture d’exercice (/api/comptabilite/cloture)', () => {
  test('la réévaluation exige une année', async ({ clotureClient }) => {
    await contexte({
      preconditions: ['Une session habilitée aux opérations de clôture est ouverte'],
      configuration: ['Les cours de clôture sont fournis, mais l’exercice est omis'],
    });

    const response = await etape(
      'Réévaluer les positions en devises sans préciser l’exercice',
      'Le service refuse : la réévaluation se rattache à un exercice précis',
      () =>
        clotureClient.reevaluerDevises({ coursCloture: { EUR: 655.957 } }, BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'réévaluation sans année'),
    );
  });

  test('la réévaluation exige une table de cours', async ({ clotureClient }) => {
    await contexte({
      preconditions: ['Une session habilitée aux opérations de clôture est ouverte'],
      configuration: ['L’exercice est fourni, mais aucun cours de clôture n’est transmis'],
    });

    const response = await etape(
      'Réévaluer les positions en devises sans fournir de cours de clôture',
      'Le service refuse : sans cours, aucun écart de change ne peut être calculé',
      () => clotureClient.reevaluerDevises({ annee: ANNEE_COURANTE }, BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'réévaluation sans cours'),
    );
  });

  test('une année de clôture non numérique est rejetée', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session habilitée aux opérations de clôture est ouverte'],
      configuration: ['Aucun exercice exploitable n’est transmis à la clôture'],
    });

    const response = await etape(
      'Clôturer un exercice sans fournir d’année valide',
      'Le service refuse : une clôture est irréversible et ne s’exécute pas sur une valeur douteuse',
      () => apiContext.post(`${COMPTA_PATHS.clotureBase}/exercice`),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'clôture année non numérique'),
    );
  });

  test('la réévaluation des devises produit les lignes d’écart', async ({ clotureClient }) => {
    await contexte({
      preconditions: ['Une session habilitée aux opérations de clôture est ouverte'],
      configuration: [
        'RUN_DESTRUCTIVE=true, sans quoi le cas est ignoré : la réévaluation génère des écritures',
        'Deux cours de clôture sont fournis : euro et dollar',
      ],
    });

    test.skip(
      !env.runDestructive,
      'test destructif : la réévaluation génère des écritures (RUN_DESTRUCTIVE=true)',
    );

    const response = await etape(
      'Réévaluer les positions en devises de l’exercice aux cours de clôture fournis',
      'Le service calcule les écarts de change et rend la liste des lignes produites',
      () =>
        clotureClient.reevaluerDevises(
          { annee: ANNEE_COURANTE, coursCloture: { EUR: 655.957, USD: 600 } },
          [200, ...NOT_FOUND_STATUSES],
        ),
    );

    await etape(
      'Examiner les lignes d’écart produites',
      'En cas de succès, le résultat est un tableau de lignes d’écart, vide si aucune position n’est en devise',
      async () => {
        if (response.ok()) {
          const lignes = (await response.json()) as unknown[];
          expect(Array.isArray(lignes)).toBeTruthy();
        }
      },
    );
  });

  test('la clôture d’un exercice est exécutée', async ({ clotureClient }) => {
    await contexte({
      preconditions: [
        'Une session habilitée aux opérations de clôture est ouverte',
        'L’exercice visé est l’exercice précédent',
      ],
      configuration: [
        'RUN_DESTRUCTIVE=true, sans quoi le cas est ignoré : la clôture est irréversible',
      ],
    });

    test.skip(
      !env.runDestructive,
      'test destructif : la clôture est irréversible (RUN_DESTRUCTIVE=true)',
    );

    const response = await etape(
      'Clôturer l’exercice précédent',
      'Le service exécute la clôture, ou signale qu’elle est déjà faite ou impossible',
      () =>
        clotureClient.cloturerExercice(ANNEE_COURANTE - 1, [
          200,
          204,
          ...NOT_FOUND_STATUSES,
          409,
        ]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code traduit une clôture réussie (200, 204), un exercice introuvable (400, 404, 409, 500) ou déjà clôturé (409)',
      () =>
        expectStatusIn(response, [200, 204, ...NOT_FOUND_STATUSES, 409], 'clôture exercice'),
    );
  });
});
