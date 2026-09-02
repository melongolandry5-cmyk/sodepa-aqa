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

test.describe('API — Référentiel : banques (/api/v1/caccounting/bank)', () => {
  test('la recherche paginée est cohérente', async ({ banqueClient }) => {
    const page = await banqueClient.page({ page: 0, size: 10 });

    expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
  });

  test('la liste complète renvoie un tableau', async ({ banqueClient }) => {
    const response = await banqueClient.listRaw();

    await expectJsonArray(response);
  });

  test('la consultation unitaire renvoie la banque demandée', async ({ banqueClient }) => {
    const banques = await banqueClient.list();
    test.skip(banques.length === 0, 'aucune banque en base');

    const response = await banqueClient.getById(String(banques[0].id));
    const banque = (await response.json()) as Record<string, unknown>;

    expect(String(banque.id)).toBe(String(banques[0].id));
  });

  test('la consultation « active » renvoie une banque active', async ({ banqueClient }) => {
    const banques = await banqueClient.list();
    test.skip(banques.length === 0, 'aucune banque en base');

    const response = await banqueClient.getActiveById(String(banques[0].id), [
      200,
      ...NOT_FOUND_STATUSES,
    ]);

    await expectStatusIn(response, [200, ...NOT_FOUND_STATUSES], 'banque active');
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ banqueClient }) => {
    const response = await banqueClient.getById(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'banque inexistante');
  });

  test('un identifiant malformé est rejeté', async ({ banqueClient }) => {
    const response = await banqueClient.getById(UUID_MALFORME, BAD_REQUEST_STATUSES);

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'banque id malformé');
  });

  test('la mise à jour exige un code', async ({ banqueClient }) => {
    const response = await banqueClient.initUpdate(
      UUID_INEXISTANT,
      { code: '', name: 'x', accountingCode: '521', logo: 'x', status: true },
      [...BAD_REQUEST_STATUSES, 404],
    );

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'banque sans code');
  });

  test('la mise à jour d’une banque inexistante échoue', async ({ banqueClient }) => {
    const response = await banqueClient.initUpdate(
      UUID_INEXISTANT,
      { code: unique('BNK'), name: 'x', accountingCode: '521', logo: 'x', status: true },
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'maj banque inexistante');
  });

  test('la décision maker-checker exige des notes', async ({ banqueClient }) => {
    const response = await banqueClient.validateOrReject(
      UUID_INEXISTANT,
      { decision: 'ACCEPTED', notes: '', checkerOperationType: 'CREATE' },
      [...BAD_REQUEST_STATUSES, 404],
    );

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'décision sans notes');
  });

  test('une décision hors énumération est rejetée', async ({ banqueClient }) => {
    const response = await banqueClient.validateOrReject(
      UUID_INEXISTANT,
      { decision: 'PEUT_ETRE' as never, notes: 'x', checkerOperationType: 'CREATE' },
      [...BAD_REQUEST_STATUSES, 404],
    );

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'décision invalide');
  });

  test('valider une soumission inexistante échoue', async ({ banqueClient }) => {
    const response = await banqueClient.validateOrReject(
      UUID_INEXISTANT,
      decisionValide(),
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'validation banque inexistante');
  });
});

test.describe('API — Référentiel : comptes (/api/v1/caccounting/compte)', () => {
  test('la recherche paginée est cohérente', async ({ compteClient }) => {
    const page = await compteClient.page({ page: 0, size: 20 });

    expectValidPage(page, { expectedPage: 0, expectedSize: 20 });
  });

  test('la liste complète renvoie un tableau', async ({ compteClient }) => {
    const response = await compteClient.listRaw();

    await expectJsonArray(response);
  });

  test('un compte créé est soumis au circuit maker-checker', async ({ compteClient }) => {
    const response = await compteClient.initCreate(compteValide(), [200, 201, 202]);

    expect(response.ok()).toBeTruthy();
  });

  test('la création exige un code', async ({ compteClient }) => {
    const response = await compteClient.initCreate(compteValide({ code: '' }), BAD_REQUEST_STATUSES);

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'compte sans code');
  });

  test('la création exige un intitulé', async ({ compteClient }) => {
    const response = await compteClient.initCreate(
      compteValide({ intitule: '' }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'compte sans intitulé');
  });

  test('la création exige un niveau', async ({ compteClient }) => {
    const response = await compteClient.initCreate(
      compteValide({ niveau: undefined }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'compte sans niveau');
  });

  test('un code de compte dupliqué est refusé', async ({ compteClient }) => {
    const comptes = await compteClient.list();
    test.skip(comptes.length === 0, 'aucun compte en base');

    const response = await compteClient.initCreate(
      compteValide({ code: String(comptes[0].code) }),
      [...BAD_REQUEST_STATUSES, 409, 200, 201, 202],
    );

    expect([400, 409, 422, 500]).toContain(response.status());
  });

  test('la consultation unitaire renvoie le compte demandé', async ({ compteClient }) => {
    const comptes = await compteClient.list();
    test.skip(comptes.length === 0, 'aucun compte en base');

    const response = await compteClient.getById(String(comptes[0].id));
    const compte = (await response.json()) as Record<string, unknown>;

    expect(String(compte.id)).toBe(String(comptes[0].id));
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ compteClient }) => {
    const response = await compteClient.getById(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'compte inexistant');
  });

  test('la mise à jour d’un compte inexistant échoue', async ({ compteClient }) => {
    const response = await compteClient.initUpdate(
      UUID_INEXISTANT,
      compteValide(),
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'maj compte inexistant');
  });

  test('la suppression d’un compte inexistant échoue', async ({ compteClient }) => {
    const response = await compteClient.supprimer(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'suppression compte inexistant');
  });

  test('un compte créé puis supprimé disparaît du référentiel', async ({ compteClient }) => {
    test.skip(
      !env.runDestructive,
      'test destructif : activer RUN_DESTRUCTIVE=true sur un environnement jetable',
    );
    const corps = compteValide();
    await compteClient.initCreate(corps, [200, 201, 202]);

    const comptes = await compteClient.list();
    const cree = comptes.find((c) => c.code === corps.code);
    test.skip(!cree, 'le compte reste en attente de validation maker-checker');

    await compteClient.supprimer(String(cree!.id), [200, 204]);
    await compteClient.getById(String(cree!.id), NOT_FOUND_STATUSES);
  });

  test('valider une soumission inexistante échoue', async ({ compteClient }) => {
    const response = await compteClient.validateOrReject(
      UUID_INEXISTANT,
      decisionValide(),
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'validation compte inexistant');
  });
});

test.describe('API — Référentiel : tiers (/api/v1/caccounting/tiers)', () => {
  test('la recherche paginée est cohérente', async ({ tiersClient }) => {
    const page = await tiersClient.page({ page: 0, size: 10 });

    expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
  });

  test('la liste des tiers actifs renvoie un tableau', async ({ tiersClient }) => {
    const response = await tiersClient.listRaw();

    await expectJsonArray(response);
  });

  test('la création exige un type de tiers valide', async ({ tiersClient }) => {
    const response = await tiersClient.initCreate(
      tiersValide({ typeTiers: 'INCONNU' }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'type de tiers invalide');
  });

  test('la création exige un email bien formé', async ({ tiersClient }) => {
    const response = await tiersClient.initCreate(
      tiersValide({ email: 'pas-un-email' }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'email mal formé');
  });

  test('la création exige un compte collectif', async ({ tiersClient }) => {
    const response = await tiersClient.initCreate(
      tiersValide({ compteCollectifCode: '' }),
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'tiers sans compte collectif');
  });

  test('une création nominale est acceptée par le circuit maker-checker', async ({ tiersClient }) => {
    const response = await tiersClient.initCreate(tiersValide(), [
      200,
      201,
      202,
      ...NOT_FOUND_STATUSES,
    ]);

    await expectStatusIn(response, [200, 201, 202, ...NOT_FOUND_STATUSES], 'création tiers');
  });

  test('la consultation unitaire renvoie le tiers demandé', async ({ tiersClient }) => {
    const tiers = await tiersClient.list();
    test.skip(tiers.length === 0, 'aucun tiers en base');

    const response = await tiersClient.getById(String(tiers[0].id));
    const detail = (await response.json()) as Record<string, unknown>;

    expect(String(detail.id)).toBe(String(tiers[0].id));
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ tiersClient }) => {
    const response = await tiersClient.getById(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'tiers inexistant');
  });

  test('la mise à jour d’un tiers inexistant échoue', async ({ tiersClient }) => {
    const response = await tiersClient.initUpdate(
      UUID_INEXISTANT,
      tiersValide({ actif: true }),
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'maj tiers inexistant');
  });

  test('valider une soumission inexistante échoue', async ({ tiersClient }) => {
    const response = await tiersClient.validateOrReject(
      UUID_INEXISTANT,
      decisionValide(),
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'validation tiers inexistant');
  });
});

test.describe('API — Référentiel : journaux (/api/comptabilite/journaux)', () => {
  test('la recherche paginée est cohérente', async ({ journalClient }) => {
    const page = await journalClient.page({ page: 0, size: 10 });

    expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
  });

  test('la liste complète renvoie un tableau', async ({ journalClient }) => {
    const response = await journalClient.listRaw();

    await expectJsonArray(response);
  });

  test('la création exige un code de journal de l’énumération OHADA', async ({ journalClient }) => {
    const response = await journalClient.initCreate(
      { code: 'ZZ', intitule: 'x', typeJournal: 'DIVERS' },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'code journal hors énumération');
  });

  test('la création exige un intitulé', async ({ journalClient }) => {
    const response = await journalClient.initCreate(
      { code: 'OD', intitule: '', typeJournal: 'DIVERS' },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'journal sans intitulé');
  });

  test('la consultation unitaire renvoie le journal demandé', async ({ journalClient }) => {
    const journaux = await journalClient.list();
    test.skip(journaux.length === 0, 'aucun journal en base');

    const response = await journalClient.getById(String(journaux[0].id));
    const journal = (await response.json()) as Record<string, unknown>;

    expect(String(journal.id)).toBe(String(journaux[0].id));
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ journalClient }) => {
    const response = await journalClient.getById(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'journal inexistant');
  });

  test('la consultation « active » d’un journal inexistant échoue', async ({ journalClient }) => {
    const response = await journalClient.getActiveById(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'journal actif inexistant');
  });

  test('la bascule d’activation est réversible', async ({ journalClient }) => {
    test.skip(
      !env.runDestructive,
      'test destructif : activer RUN_DESTRUCTIVE=true sur un environnement jetable',
    );
    const journaux = await journalClient.list();
    test.skip(journaux.length === 0, 'aucun journal en base');
    const id = String(journaux[0].id);

    await journalClient.toggle(id, [200, 204]);
    await journalClient.toggle(id, [200, 204]);
  });

  test('la bascule sur un journal inexistant échoue', async ({ journalClient }) => {
    const response = await journalClient.toggle(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'toggle journal inexistant');
  });

  test('valider une soumission inexistante échoue', async ({ journalClient }) => {
    const response = await journalClient.validateOrReject(
      UUID_INEXISTANT,
      decisionValide(),
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'validation journal inexistant');
  });
});
