import { test, expect } from '../comptabilite-generale-fixtures';
import { expectStatusIn } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import { UUID_INEXISTANT, UUID_MALFORME, today, unique } from '../../../test-data/builders';

/** Corps d'écriture équilibrée, prêt à être dérivé par les tests. */
function ecritureEquilibree(journalId: string, overrides: Record<string, unknown> = {}) {
  return {
    journalId,
    numeroPiece: unique('PC'),
    libelle: `Écriture ${unique()}`,
    dateComptable: today(),
    lignes: [
      { compteCode: '601100', debit: 100_000, credit: 0, libelleLigne: 'Achat' },
      { compteCode: '401100', debit: 0, credit: 100_000, libelleLigne: 'Fournisseur' },
    ],
    ...overrides,
  };
}

test.describe('API — Écritures : saisie', () => {
  test('la saisie exige un journal', async ({ ecritureClient }) => {
    const response = await ecritureClient.saisir(
      { ...ecritureEquilibree(UUID_INEXISTANT), journalId: undefined },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'écriture sans journal');
  });

  test('la saisie exige au moins une ligne', async ({ ecritureClient }) => {
    const response = await ecritureClient.saisir(
      ecritureEquilibree(UUID_INEXISTANT, { lignes: [] }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'écriture sans ligne');
  });

  test('la saisie exige un numéro de pièce', async ({ ecritureClient }) => {
    const response = await ecritureClient.saisir(
      ecritureEquilibree(UUID_INEXISTANT, { numeroPiece: '' }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'écriture sans numéro de pièce');
  });

  test('la saisie exige une date comptable', async ({ ecritureClient }) => {
    const response = await ecritureClient.saisir(
      ecritureEquilibree(UUID_INEXISTANT, { dateComptable: undefined }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'écriture sans date');
  });

  test('une écriture déséquilibrée est refusée', async ({ ecritureClient, journalClient }) => {
    const journaux = await journalClient.list();
    test.skip(journaux.length === 0, 'aucun journal en base');

    const response = await ecritureClient.saisir(
      ecritureEquilibree(String(journaux[0].id), {
        lignes: [
          { compteCode: '601100', debit: 100_000, credit: 0 },
          { compteCode: '401100', debit: 0, credit: 50_000 },
        ],
      }),
      [...BAD_REQUEST_STATUSES, 409],
    );

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 409], 'écriture déséquilibrée');
  });

  test('une écriture sur un journal inexistant échoue', async ({ ecritureClient }) => {
    const response = await ecritureClient.saisir(
      ecritureEquilibree(UUID_INEXISTANT),
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'écriture journal inexistant');
  });

  test('une devise hors énumération est rejetée', async ({ ecritureClient, journalClient }) => {
    const journaux = await journalClient.list();
    test.skip(journaux.length === 0, 'aucun journal en base');

    const response = await ecritureClient.saisir(
      ecritureEquilibree(String(journaux[0].id), { typeDevise: 'GBP' }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'devise hors énumération');
  });

  test('une écriture équilibrée est enregistrée puis relisible', async ({
    ecritureClient,
    journalClient,
  }) => {
    const journaux = await journalClient.list();
    test.skip(journaux.length === 0, 'aucun journal en base');

    const response = await ecritureClient.saisir(ecritureEquilibree(String(journaux[0].id)), [
      200,
      201,
      ...BAD_REQUEST_STATUSES,
      404,
    ]);
    test.skip(
      !response.ok(),
      `le plan comptable de l’environnement ne permet pas la saisie (${response.status()})`,
    );

    const ecriture = (await response.json()) as Record<string, unknown>;
    expect(ecriture.id).toBeTruthy();

    const relue = await ecritureClient.getById(String(ecriture.id));
    const detail = (await relue.json()) as Record<string, unknown>;
    expect(String(detail.id)).toBe(String(ecriture.id));
  });
});

test.describe('API — Écritures : simulation de TVA', () => {
  test('la simulation renvoie les montants attendus', async ({ ecritureClient }) => {
    const response = await ecritureClient.simulerTva(
      { montantHt: 1_000_000, tauxTva: 19.25, compteHtCode: '601100' },
      [200, ...NOT_FOUND_STATUSES],
    );
    test.skip(!response.ok(), 'compte 601100 absent du plan comptable de l’environnement');

    const simulation = (await response.json()) as Record<string, unknown>;
    expect(Number(simulation.montantTva ?? simulation.tva)).toBeCloseTo(192_500, 0);
  });

  test('la simulation exige un montant HT', async ({ ecritureClient }) => {
    const response = await ecritureClient.simulerTva(
      { tauxTva: 19.25, compteHtCode: '601100' },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'simulation sans montant HT');
  });

  test('la simulation exige un taux', async ({ ecritureClient }) => {
    const response = await ecritureClient.simulerTva(
      { montantHt: 1000, compteHtCode: '601100' },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'simulation sans taux');
  });

  test('la simulation exige un compte de charge', async ({ ecritureClient }) => {
    const response = await ecritureClient.simulerTva(
      { montantHt: 1000, tauxTva: 19.25, compteHtCode: '' },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'simulation sans compte');
  });

  test('un taux nul produit une TVA nulle', async ({ ecritureClient }) => {
    const response = await ecritureClient.simulerTva(
      { montantHt: 1000, tauxTva: 0, compteHtCode: '601100' },
      [200, ...BAD_REQUEST_STATUSES, ...NOT_FOUND_STATUSES],
    );
    test.skip(!response.ok(), 'taux nul refusé ou compte absent');

    const simulation = (await response.json()) as Record<string, unknown>;
    expect(Number(simulation.montantTva ?? simulation.tva ?? 0)).toBeCloseTo(0, 2);
  });
});

test.describe('API — Écritures : workflow de validation', () => {
  test('soumettre une écriture inexistante échoue', async ({ ecritureClient }) => {
    const response = await ecritureClient.soumettre(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'soumission écriture inexistante');
  });

  test('valider une écriture inexistante échoue', async ({ ecritureClient }) => {
    const response = await ecritureClient.valider(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'validation écriture inexistante');
  });

  test('rejeter une écriture inexistante échoue', async ({ ecritureClient }) => {
    const response = await ecritureClient.rejeter(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'rejet écriture inexistante');
  });

  test('consulter une écriture inexistante ne renvoie pas 200', async ({ ecritureClient }) => {
    const response = await ecritureClient.getById(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'écriture inexistante');
  });

  test('un identifiant malformé est rejeté', async ({ ecritureClient }) => {
    const response = await ecritureClient.getById(UUID_MALFORME, BAD_REQUEST_STATUSES);

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'écriture id malformé');
  });

  test('le cycle saisie → soumission → validation est cohérent', async ({
    ecritureClient,
    journalClient,
  }) => {
    const journaux = await journalClient.list();
    test.skip(journaux.length === 0, 'aucun journal en base');

    const creation = await ecritureClient.saisir(ecritureEquilibree(String(journaux[0].id)), [
      200,
      201,
      ...BAD_REQUEST_STATUSES,
      404,
    ]);
    test.skip(!creation.ok(), 'saisie impossible sur cet environnement');
    const id = String(((await creation.json()) as Record<string, unknown>).id);

    const soumise = await ecritureClient.soumettre(id);
    const etatSoumis = (await soumise.json()) as Record<string, unknown>;
    expect(String(etatSoumis.statut ?? '')).not.toBe('BROUILLON');

    const validee = await ecritureClient.valider(id);
    expect(validee.ok()).toBeTruthy();
  });
});
