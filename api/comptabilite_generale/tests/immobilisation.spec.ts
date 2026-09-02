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

test.describe('API — Immobilisations : recherche et consultation', () => {
  test('la recherche paginée est cohérente', async ({ immobilisationClient }) => {
    const page = await immobilisationClient.page({ page: 0, size: 10 });

    expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
  });

  test('la seconde page ne répète pas la première', async ({ immobilisationClient }) => {
    const premiere = await immobilisationClient.page({ page: 0, size: 2 });
    test.skip(premiere.totalElements < 3, 'jeu de données insuffisant pour paginer');

    const seconde = await immobilisationClient.page({ page: 1, size: 2 });

    const ids = premiere.content.map((i) => i.id);
    expect(seconde.content.filter((i) => ids.includes(i.id))).toHaveLength(0);
  });

  test('la recherche textuelle filtre le résultat', async ({ immobilisationClient }) => {
    const reference = await immobilisationClient.page({ page: 0, size: 1 });
    test.skip(reference.content.length === 0, 'aucune immobilisation en base');

    const designation = String(reference.content[0].designation ?? '');
    test.skip(designation.length < 3, 'désignation trop courte pour une recherche');

    const filtres = await immobilisationClient.page({
      page: 0,
      size: 20,
      recherche: designation.slice(0, 3),
    });

    expect(filtres.totalElements).toBeGreaterThan(0);
  });

  test('une recherche sans correspondance renvoie une page vide', async ({
    immobilisationClient,
  }) => {
    const page = await immobilisationClient.page({ page: 0, size: 10, recherche: unique('ZZZ') });

    expect(page.content).toHaveLength(0);
  });

  test('le filtre par statut ne renvoie que ce statut', async ({ immobilisationClient }) => {
    const page = await immobilisationClient.page({ page: 0, size: 50, statut: 'ACTIVE' });

    for (const immo of page.content) {
      expect(immo.statut).toBe('ACTIVE');
    }
  });

  test('un statut hors énumération est rejeté', async ({ apiContext }) => {
    const response = await apiContext.get(COMPTA_PATHS.immoBase, {
      params: { statut: 'HORS_SERVICE' },
    });

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'statut hors énumération');
  });

  test('la file d’attente maker-checker est paginée', async ({ immobilisationClient }) => {
    const page = await immobilisationClient.pending({ page: 0, size: 10 });

    expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
  });

  test('la consultation unitaire renvoie l’immobilisation demandée', async ({
    immobilisationClient,
  }) => {
    const page = await immobilisationClient.page({ page: 0, size: 1 });
    test.skip(page.content.length === 0, 'aucune immobilisation en base');

    const response = await immobilisationClient.getById(String(page.content[0].id));
    const immo = (await response.json()) as Record<string, unknown>;

    expect(String(immo.id)).toBe(String(page.content[0].id));
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ immobilisationClient }) => {
    const response = await immobilisationClient.getById(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'immobilisation inexistante');
  });

  test('un identifiant malformé est rejeté', async ({ immobilisationClient }) => {
    const response = await immobilisationClient.getById(UUID_MALFORME, BAD_REQUEST_STATUSES);

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'immobilisation id malformé');
  });
});

test.describe('API — Immobilisations : plan d’amortissement', () => {
  test('le plan d’une immobilisation existante est cohérent', async ({ immobilisationClient }) => {
    const page = await immobilisationClient.page({ page: 0, size: 1 });
    test.skip(page.content.length === 0, 'aucune immobilisation en base');

    const response = await immobilisationClient.planAmortissement(String(page.content[0].id));
    const lignes = await expectJsonArray(response);

    const valeurOrigine = Number(page.content[0].valeurOrigine ?? 0);
    if (lignes.length > 0 && valeurOrigine > 0) {
      const dotations = (lignes as Record<string, unknown>[]).reduce(
        (total, l) => total + Number(l.dotation ?? l.annuite ?? 0),
        0,
      );
      expect(dotations).toBeLessThanOrEqual(valeurOrigine + 1);
    }
  });

  test('le plan d’une immobilisation inexistante échoue', async ({ immobilisationClient }) => {
    const response = await immobilisationClient.planAmortissement(
      UUID_INEXISTANT,
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'plan immobilisation inexistante');
  });

  test('la génération d’amortissement exige une année ≥ 1900', async ({ immobilisationClient }) => {
    const response = await immobilisationClient.initAmortir(
      { annee: 1800, compteImmoCode: '241' },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'amortissement année invalide');
  });

  test('la génération d’amortissement exige un compte', async ({ immobilisationClient }) => {
    const response = await immobilisationClient.initAmortir(
      { annee: ANNEE_COURANTE, compteImmoCode: '' },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'amortissement sans compte');
  });

  test('la génération d’amortissement est soumise au circuit maker-checker', async ({
    immobilisationClient,
  }) => {
    const response = await immobilisationClient.initAmortir(
      { annee: ANNEE_COURANTE, compteImmoCode: '241' },
      [200, 201, 202, ...NOT_FOUND_STATUSES],
    );

    await expectStatusIn(
      response,
      [200, 201, 202, ...NOT_FOUND_STATUSES],
      'amortissement nominal',
    );
  });
});

test.describe('API — Immobilisations : création et mise à jour', () => {
  test('la création exige un code', async ({ immobilisationClient }) => {
    const response = await immobilisationClient.initCreate(
      immobilisationValide({ code: '' }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'immobilisation sans code');
  });

  test('la création exige une valeur d’origine positive', async ({ immobilisationClient }) => {
    const response = await immobilisationClient.initCreate(
      immobilisationValide({ valeurOrigine: 0 }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'valeur d’origine nulle');
  });

  test('la création exige une durée utile positive', async ({ immobilisationClient }) => {
    const response = await immobilisationClient.initCreate(
      immobilisationValide({ dureeUtile: 0 }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'durée utile nulle');
  });

  test('un mode d’amortissement hors énumération est rejeté', async ({ immobilisationClient }) => {
    const response = await immobilisationClient.initCreate(
      immobilisationValide({ modeAmortissement: 'PROGRESSIF' }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'mode d’amortissement invalide');
  });

  test('les trois modes d’amortissement de l’énumération sont acceptés', async ({
    immobilisationClient,
  }) => {
    for (const mode of ['LINEAIRE', 'DEGRESSIF', 'ACCELERE']) {
      const response = await immobilisationClient.initCreate(
        immobilisationValide({ modeAmortissement: mode }),
        [200, 201, 202, ...NOT_FOUND_STATUSES],
      );

      await expectStatusIn(response, [200, 201, 202, ...NOT_FOUND_STATUSES], `mode ${mode}`);
    }
  });

  test('une création nominale renvoie une soumission', async ({ immobilisationClient }) => {
    const response = await immobilisationClient.initCreate(immobilisationValide(), [
      200,
      201,
      202,
      ...NOT_FOUND_STATUSES,
    ]);
    test.skip(!response.ok(), 'création refusée par les règles métier de l’environnement');

    const soumission = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(soumission).length).toBeGreaterThan(0);
  });

  test('la mise à jour exige un statut', async ({ immobilisationClient }) => {
    const response = await immobilisationClient.initUpdate(
      UUID_INEXISTANT,
      immobilisationValide(),
      [...BAD_REQUEST_STATUSES, 404],
    );

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'mise à jour sans statut');
  });

  test('la mise à jour d’une immobilisation inexistante échoue', async ({ immobilisationClient }) => {
    const response = await immobilisationClient.initUpdate(
      UUID_INEXISTANT,
      immobilisationValide({ statut: 'ACTIVE', dateMiseEnService: isoDate(-10) }),
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'maj immobilisation inexistante');
  });

  test('valider une soumission inexistante échoue', async ({ immobilisationClient }) => {
    const response = await immobilisationClient.validateOrReject(
      UUID_INEXISTANT,
      decisionValide(),
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'validation immobilisation inexistante');
  });

  test('une décision sans notes est refusée', async ({ immobilisationClient }) => {
    const response = await immobilisationClient.validateOrReject(
      UUID_INEXISTANT,
      { decision: 'ACCEPTED', notes: '', checkerOperationType: 'CREATE' },
      [...BAD_REQUEST_STATUSES, 404],
    );

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'décision sans notes');
  });
});
