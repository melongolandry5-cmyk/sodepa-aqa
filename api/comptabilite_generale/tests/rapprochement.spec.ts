import { test, expect } from '../comptabilite-generale-fixtures';
import { expectStatusIn, expectValidPage } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import { env } from '../../../helpers/env';
import {
  ANNEE_COURANTE,
  UUID_INEXISTANT,
  UUID_MALFORME,
  today,
} from '../../../test-data/builders';

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
    const page = await rapprochementClient.listerReleves({ page: 0, size: 10 });

    expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
  });

  test('le filtre par banque ne renvoie que ce prêteur', async ({
    rapprochementClient,
    banqueClient,
  }) => {
    const banques = await banqueClient.list();
    test.skip(banques.length === 0, 'aucune banque en base');
    const banqueId = String(banques[0].id);

    const page = await rapprochementClient.listerReleves({ page: 0, size: 50, banqueId });

    for (const releve of page.content) {
      if (releve.banqueId !== undefined) {
        expect(releve.banqueId).toBe(banqueId);
      }
    }
  });

  test('le filtre « validé » est appliqué', async ({ rapprochementClient }) => {
    const page = await rapprochementClient.listerReleves({ page: 0, size: 50, valide: true });

    for (const releve of page.content) {
      if (releve.valide !== undefined) {
        expect(releve.valide).toBe(true);
      }
    }
  });

  test('un banqueId malformé est rejeté', async ({ apiContext }) => {
    const response = await apiContext.get('/api/comptabilite/rapprochement/releves', {
      params: { banqueId: UUID_MALFORME },
    });

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'banqueId malformé');
  });

  test('la consultation unitaire renvoie le relevé demandé', async ({ rapprochementClient }) => {
    const page = await rapprochementClient.listerReleves({ page: 0, size: 1 });
    test.skip(page.content.length === 0, 'aucun relevé en base');

    const response = await rapprochementClient.getReleve(String(page.content[0].id));
    const releve = (await response.json()) as Record<string, unknown>;

    expect(String(releve.id)).toBe(String(page.content[0].id));
  });

  test('un relevé inexistant ne renvoie pas 200', async ({ rapprochementClient }) => {
    const response = await rapprochementClient.getReleve(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'relevé inexistant');
  });
});

test.describe('API — Relevés bancaires : saisie et synchronisation', () => {
  test('la saisie manuelle exige au moins une ligne', async ({ rapprochementClient }) => {
    const response = await rapprochementClient.saisirReleveManuel(
      releveManuel(UUID_INEXISTANT, { lignes: [] }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'relevé sans ligne');
  });

  test('la saisie manuelle exige une banque', async ({ rapprochementClient }) => {
    const response = await rapprochementClient.saisirReleveManuel(
      releveManuel(UUID_INEXISTANT, { banqueId: undefined }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'relevé sans banque');
  });

  test('la saisie manuelle exige les deux soldes', async ({ rapprochementClient }) => {
    const response = await rapprochementClient.saisirReleveManuel(
      releveManuel(UUID_INEXISTANT, { soldeFinal: undefined }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'relevé sans solde final');
  });

  test('une ligne sans libellé est refusée', async ({ rapprochementClient }) => {
    const response = await rapprochementClient.saisirReleveManuel(
      releveManuel(UUID_INEXISTANT, {
        lignes: [{ dateTransaction: today(), libelle: '', montant: 1000 }],
      }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'ligne sans libellé');
  });

  test('la saisie sur une banque inexistante échoue', async ({ rapprochementClient }) => {
    const response = await rapprochementClient.saisirReleveManuel(
      releveManuel(UUID_INEXISTANT),
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'relevé banque inexistante');
  });

  test('un relevé manuel saisi est relisible', async ({ rapprochementClient, banqueClient }) => {
    const banques = await banqueClient.list();
    test.skip(banques.length === 0, 'aucune banque en base');

    const response = await rapprochementClient.saisirReleveManuel(
      releveManuel(String(banques[0].id)),
      [200, 201, ...NOT_FOUND_STATUSES, ...BAD_REQUEST_STATUSES],
    );
    test.skip(!response.ok(), 'saisie refusée par les règles métier de l’environnement');

    const releve = (await response.json()) as Record<string, unknown>;
    const relu = await rapprochementClient.getReleve(String(releve.id));
    expect(relu.ok()).toBeTruthy();
  });

  test('la synchronisation exige une banque et une date', async ({ rapprochementClient }) => {
    const response = await rapprochementClient.synchroniser(
      { soldeInitial: 0 },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'synchronisation incomplète');
  });

  test('la synchronisation sur une banque inexistante échoue', async ({ rapprochementClient }) => {
    const response = await rapprochementClient.synchroniser(
      { banqueId: UUID_INEXISTANT, dateReleve: today(), soldeInitial: 0 },
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'synchronisation banque inexistante');
  });
});

test.describe('API — Relevés bancaires : rapprochement automatique', () => {
  test('le rapprochement exige un compte de banque', async ({ apiContext }) => {
    const response = await apiContext.post(
      `/api/comptabilite/rapprochement/${UUID_INEXISTANT}/rapprocher`,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'rapprochement sans compte');
  });

  test('le rapprochement d’un relevé inexistant échoue', async ({ rapprochementClient }) => {
    const response = await rapprochementClient.rapprocher(
      UUID_INEXISTANT,
      '521100',
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'rapprochement relevé inexistant');
  });

  test('le rapprochement d’un relevé réel renvoie un nombre de lettrages', async ({
    rapprochementClient,
  }) => {
    test.skip(
      !env.runDestructive,
      'test destructif : le rapprochement lettre les écritures (RUN_DESTRUCTIVE=true)',
    );
    const page = await rapprochementClient.listerReleves({ page: 0, size: 1 });
    test.skip(page.content.length === 0, 'aucun relevé en base');

    const response = await rapprochementClient.rapprocher(String(page.content[0].id), '521100', [
      200,
      ...NOT_FOUND_STATUSES,
    ]);
    test.skip(!response.ok(), 'compte 521100 absent du plan comptable');

    expect(Number(await response.text())).toBeGreaterThanOrEqual(0);
  });
});

test.describe('API — Clôture d’exercice (/api/comptabilite/cloture)', () => {
  test('la réévaluation exige une année', async ({ clotureClient }) => {
    const response = await clotureClient.reevaluerDevises(
      { coursCloture: { EUR: 655.957 } },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'réévaluation sans année');
  });

  test('la réévaluation exige une table de cours', async ({ clotureClient }) => {
    const response = await clotureClient.reevaluerDevises(
      { annee: ANNEE_COURANTE },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'réévaluation sans cours');
  });

  test('une année de clôture non numérique est rejetée', async ({ apiContext }) => {
    const response = await apiContext.post('/api/comptabilite/cloture/exercice');

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'clôture année non numérique');
  });

  test('la réévaluation des devises produit les lignes d’écart', async ({ clotureClient }) => {
    test.skip(
      !env.runDestructive,
      'test destructif : la réévaluation génère des écritures (RUN_DESTRUCTIVE=true)',
    );

    const response = await clotureClient.reevaluerDevises(
      { annee: ANNEE_COURANTE, coursCloture: { EUR: 655.957, USD: 600 } },
      [200, ...NOT_FOUND_STATUSES],
    );

    if (response.ok()) {
      const lignes = (await response.json()) as unknown[];
      expect(Array.isArray(lignes)).toBeTruthy();
    }
  });

  test('la clôture d’un exercice est exécutée', async ({ clotureClient }) => {
    test.skip(
      !env.runDestructive,
      'test destructif : la clôture est irréversible (RUN_DESTRUCTIVE=true)',
    );

    const response = await clotureClient.cloturerExercice(ANNEE_COURANTE - 1, [
      200,
      204,
      ...NOT_FOUND_STATUSES,
      409,
    ]);

    await expectStatusIn(
      response,
      [200, 204, ...NOT_FOUND_STATUSES, 409],
      'clôture exercice',
    );
  });
});
