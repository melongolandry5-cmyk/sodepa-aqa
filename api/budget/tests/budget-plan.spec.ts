import { test, expect } from '../budget-fixtures';
import { planBudgetaireValide } from '../budget-payload-builder';
import { BUDGET_PATHS } from '../budget-api-paths';
import { expectStatusIn, expectValidPage } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import {
  ANNEE_COURANTE,
  UUID_INEXISTANT,
  UUID_MALFORME,
  unique,
} from '../../../test-data/builders';

test.describe('API — Plans budgétaires (/api/budget/plans)', () => {
  test('la recherche paginée est cohérente', async ({ budgetClient }) => {
    const page = await budgetClient.listerPlans({ page: 0, size: 10 });

    expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
  });

  test('la taille de page est respectée', async ({ budgetClient }) => {
    const page = await budgetClient.listerPlans({ page: 0, size: 3 });

    expect(page.content.length).toBeLessThanOrEqual(3);
    expect(page.size).toBe(3);
  });

  test('la seconde page ne répète pas la première', async ({ budgetClient }) => {
    const premiere = await budgetClient.listerPlans({ page: 0, size: 2 });
    test.skip(premiere.totalElements < 3, 'jeu de données insuffisant pour paginer');

    const seconde = await budgetClient.listerPlans({ page: 1, size: 2 });
    expectValidPage(seconde, { expectedPage: 1, expectedSize: 2 });

    const ids = premiere.content.map((p) => p.id);
    expect(seconde.content.filter((p) => ids.includes(p.id))).toHaveLength(0);
  });

  test('une page au-delà du dernier index renvoie un contenu vide', async ({ budgetClient }) => {
    const premiere = await budgetClient.listerPlans({ page: 0, size: 10 });

    const horsBornes = await budgetClient.listerPlans({ page: premiere.totalPages + 5, size: 10 });

    expect(horsBornes.content).toHaveLength(0);
    expect(horsBornes.empty).toBe(true);
  });

  test('le filtre par année ne renvoie que cette année', async ({ budgetClient }) => {
    const reference = await budgetClient.listerPlans({ page: 0, size: 1 });
    test.skip(reference.content.length === 0, 'aucun plan en base');

    const annee = (reference.content[0].annee ?? reference.content[0].exercice) as number | undefined;
    test.skip(annee === undefined, 'le plan de référence ne porte pas d’année');

    const filtres = await budgetClient.listerPlans({ page: 0, size: 50, annee });
    for (const plan of filtres.content) {
      expect(plan.annee ?? plan.exercice).toBe(annee);
    }
  });

  test('le filtre par statut ne renvoie que ce statut', async ({ budgetClient }) => {
    const filtres = await budgetClient.listerPlans({ page: 0, size: 50, statut: 'DRAFT' });

    expectValidPage(filtres, { expectedPage: 0 });
    for (const plan of filtres.content) {
      expect(plan.statut).toBe('DRAFT');
    }
  });

  test('un statut hors énumération est rejeté', async ({ apiContext }) => {
    const response = await apiContext.get(BUDGET_PATHS.plans, {
      params: { statut: 'STATUT_INCONNU' },
    });

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'statut invalide');
  });

  test('la consultation unitaire renvoie le plan demandé', async ({ budgetClient }) => {
    const page = await budgetClient.listerPlans({ page: 0, size: 1 });
    test.skip(page.content.length === 0, 'aucun plan en base');

    const plan = await budgetClient.getPlan(page.content[0].id);

    expect(plan.id).toBe(page.content[0].id);
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ budgetClient }) => {
    const response = await budgetClient.getPlanRaw(UUID_INEXISTANT, NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'plan inexistant');
  });

  test('un identifiant malformé est rejeté en 400', async ({ budgetClient }) => {
    const response = await budgetClient.getPlanRaw(UUID_MALFORME, BAD_REQUEST_STATUSES);

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'plan id malformé');
  });

  test('la création exige un intitulé', async ({ budgetClient }) => {
    const response = await budgetClient.creerPlanRaw(
      { annee: ANNEE_COURANTE, intitule: '', utilisateurId: UUID_INEXISTANT },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'intitulé vide');
  });

  test('la création exige une année positive', async ({ budgetClient }) => {
    const response = await budgetClient.creerPlanRaw(
      { annee: -1, intitule: 'x', utilisateurId: UUID_INEXISTANT },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'année négative');
  });

  test('la création exige un utilisateurId', async ({ budgetClient }) => {
    const response = await budgetClient.creerPlanRaw(
      { annee: ANNEE_COURANTE, intitule: 'x' },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'utilisateurId manquant');
  });

  test('un plan créé est consultable et son cycle de vie est exploitable', async ({
    budgetClient,
    userClient,
  }) => {
    const utilisateurs = await userClient.page({ page: 0, size: 1 });
    test.skip(utilisateurs.content.length === 0, 'aucun utilisateur en base');
    const utilisateurId = String(utilisateurs.content[0].id);

    const cree = await budgetClient.creerPlan(planBudgetaireValide(utilisateurId));

    expect(cree.id).toBeTruthy();
    const relu = await budgetClient.getPlan(cree.id);
    expect(relu.id).toBe(cree.id);
    expect(relu.statut).toBe('DRAFT');

    const item = await budgetClient.ajouterItem(cree.id, { compteCode: '605200', montant: 500_000 });
    expect(item).toBeTruthy();

    await budgetClient.soumettrePlan(cree.id, utilisateurId);
    const soumis = await budgetClient.getPlan(cree.id);
    expect(soumis.statut).toBe('SUBMITTED');

    await budgetClient.approuverPlan(cree.id, utilisateurId);
    const approuve = await budgetClient.getPlan(cree.id);
    expect(approuve.statut).toBe('PUBLISHED');
  });

  test('un poste au montant négatif est refusé', async ({ budgetClient }) => {
    const response = await budgetClient.ajouterItemRaw(
      UUID_INEXISTANT,
      { compteCode: '605200', montant: -10 },
      [...BAD_REQUEST_STATUSES, 404],
    );

    await expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'montant négatif');
  });

  test('soumettre un plan inexistant échoue', async ({ budgetClient }) => {
    const response = await budgetClient.soumettrePlan(UUID_INEXISTANT, UUID_INEXISTANT, [
      ...NOT_FOUND_STATUSES,
    ]);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'soumission plan inexistant');
  });

  test('approuver un plan inexistant échoue', async ({ budgetClient }) => {
    const response = await budgetClient.approuverPlan(UUID_INEXISTANT, UUID_INEXISTANT, [
      ...NOT_FOUND_STATUSES,
    ]);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'approbation plan inexistant');
  });

  test('rejeter un plan inexistant échoue', async ({ budgetClient }) => {
    const response = await budgetClient.rejeterPlan(UUID_INEXISTANT, UUID_INEXISTANT, [
      ...NOT_FOUND_STATUSES,
    ]);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'rejet plan inexistant');
  });

  test('le paramètre userId est obligatoire pour soumettre', async ({ apiContext }) => {
    const response = await apiContext.post(BUDGET_PATHS.planSoumettre(UUID_INEXISTANT));

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'soumettre sans userId');
  });

  test('une réallocation vers un poste inexistant échoue', async ({ budgetClient }) => {
    const response = await budgetClient.reallocer(
      {
        sourceItemId: UUID_INEXISTANT,
        destItemId: UUID_INEXISTANT,
        montant: 1000,
        responsableId: UUID_INEXISTANT,
        raison: 'test AQA',
      },
      [...NOT_FOUND_STATUSES],
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'réallocation postes inexistants');
  });

  test('une réallocation sans raison est refusée', async ({ budgetClient }) => {
    const response = await budgetClient.reallocer(
      {
        sourceItemId: UUID_INEXISTANT,
        destItemId: UUID_INEXISTANT,
        montant: 1000,
        responsableId: UUID_INEXISTANT,
        raison: '',
      },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'réallocation sans raison');
  });
});

test.describe('API — Engagements budgétaires (/api/budget/engagements)', () => {
  test('la recherche paginée est cohérente', async ({ budgetClient }) => {
    const page = await budgetClient.listerEngagements({ page: 0, size: 10 });

    expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
  });

  test('le filtre par plan ne renvoie que ses engagements', async ({ budgetClient }) => {
    const engagements = await budgetClient.listerEngagements({ page: 0, size: 1 });
    test.skip(engagements.content.length === 0, 'aucun engagement en base');

    const planId = engagements.content[0].planId as string | undefined;
    test.skip(!planId, 'l’engagement de référence ne porte pas de planId');

    const filtres = await budgetClient.listerEngagements({ page: 0, size: 50, planId });
    for (const engagement of filtres.content) {
      expect(engagement.planId).toBe(planId);
    }
  });

  test('la consultation par numéro renvoie l’engagement demandé', async ({ budgetClient }) => {
    const page = await budgetClient.listerEngagements({ page: 0, size: 1 });
    test.skip(page.content.length === 0, 'aucun engagement en base');

    const numero = String(page.content[0].numero ?? page.content[0].numeroEngagement);
    const engagement = await budgetClient.getEngagement(numero);

    expect(String(engagement.numero ?? engagement.numeroEngagement)).toBe(numero);
  });

  test('un numéro inexistant ne renvoie pas 200', async ({ budgetClient }) => {
    const response = await budgetClient.getEngagementRaw(unique('INEXISTANT'), NOT_FOUND_STATUSES);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'engagement inexistant');
  });

  test('engager sur un plan inexistant échoue', async ({ budgetClient }) => {
    const response = await budgetClient.engagerRaw(
      {
        planId: UUID_INEXISTANT,
        compteCode: '605200',
        numeroEngagement: unique('ENG'),
        description: 'test AQA',
        montant: 1000,
        utilisateurId: UUID_INEXISTANT,
      },
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'engagement plan inexistant');
  });

  test('engager sans compteCode est refusé', async ({ budgetClient }) => {
    const response = await budgetClient.engagerRaw(
      {
        planId: UUID_INEXISTANT,
        numeroEngagement: unique('ENG'),
        description: 'x',
        montant: 1000,
        utilisateurId: UUID_INEXISTANT,
      },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'engagement sans compteCode');
  });

  test('engager un montant nul est refusé', async ({ budgetClient }) => {
    const response = await budgetClient.engagerRaw(
      {
        planId: UUID_INEXISTANT,
        compteCode: '605200',
        numeroEngagement: unique('ENG'),
        description: 'x',
        montant: 0,
        utilisateurId: UUID_INEXISTANT,
      },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'engagement montant nul');
  });

  test('liquider un engagement inexistant échoue', async ({ budgetClient }) => {
    const response = await budgetClient.liquider(unique('INEXISTANT'), UUID_INEXISTANT, [
      ...NOT_FOUND_STATUSES,
    ]);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'liquidation inexistante');
  });

  test('annuler un engagement inexistant échoue', async ({ budgetClient }) => {
    const response = await budgetClient.annuler(unique('INEXISTANT'), UUID_INEXISTANT, [
      ...NOT_FOUND_STATUSES,
    ]);

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'annulation inexistante');
  });
});
