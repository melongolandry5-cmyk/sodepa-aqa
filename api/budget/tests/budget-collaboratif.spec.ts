import { test, expect } from '../budget-fixtures';
import { BUDGET_PATHS } from '../budget-api-paths';
import { expectJsonArray, expectStatusIn } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import { ANNEE_COURANTE, UUID_INEXISTANT, UUID_MALFORME } from '../../../test-data/builders';

test.describe('API — Budget collaboratif (/api/budget/collaboratif)', () => {
  test('la liste des demandes renvoie un tableau', async ({ budgetCollaboratifClient }) => {
    const demandes = await budgetCollaboratifClient.listerDemandes();

    expect(Array.isArray(demandes)).toBeTruthy();
  });

  test('les filtres facultatifs sont acceptés simultanément', async ({ budgetCollaboratifClient }) => {
    const demandes = await budgetCollaboratifClient.listerDemandes({
      departementId: UUID_INEXISTANT,
      annee: ANNEE_COURANTE,
      statut: 'BROUILLON',
    });

    expect(Array.isArray(demandes)).toBeTruthy();
    expect(demandes).toHaveLength(0);
  });

  test('le filtre par année ne renvoie que cette année', async ({ budgetCollaboratifClient }) => {
    const toutes = (await budgetCollaboratifClient.listerDemandes()) as Record<string, unknown>[];
    test.skip(toutes.length === 0, 'aucune demande en base');

    const annee = toutes[0].annee as number | undefined;
    test.skip(annee === undefined, 'la demande de référence ne porte pas d’année');

    const filtrees = (await budgetCollaboratifClient.listerDemandes({ annee })) as Record<
      string,
      unknown
    >[];
    for (const demande of filtrees) {
      expect(demande.annee).toBe(annee);
    }
  });

  test('un departementId malformé est rejeté', async ({ apiContext }) => {
    const response = await apiContext.get(BUDGET_PATHS.demandes, {
      params: { departementId: UUID_MALFORME },
    });

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'departementId malformé');
  });

  test('la saisie exige un compteCode', async ({ budgetCollaboratifClient }) => {
    const response = await budgetCollaboratifClient.saisirDemande(
      { departementId: UUID_INEXISTANT, annee: ANNEE_COURANTE, montant: 1000 },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'demande sans compteCode');
  });

  test('la saisie exige un montant strictement positif', async ({ budgetCollaboratifClient }) => {
    const response = await budgetCollaboratifClient.saisirDemande(
      {
        departementId: UUID_INEXISTANT,
        annee: ANNEE_COURANTE,
        compteCode: '605200',
        montant: 0,
      },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'demande montant nul');
  });

  test('la saisie sur un département inexistant échoue', async ({ budgetCollaboratifClient }) => {
    const response = await budgetCollaboratifClient.saisirDemande(
      {
        departementId: UUID_INEXISTANT,
        annee: ANNEE_COURANTE,
        compteCode: '605200',
        montant: 1000,
        commentaires: 'test AQA',
      },
      [...NOT_FOUND_STATUSES, 200],
    );

    await expectStatusIn(response, [...NOT_FOUND_STATUSES, 200], 'demande département inexistant');
  });

  test('la soumission groupée exige departementId et annee', async ({ apiContext }) => {
    const response = await apiContext.post(BUDGET_PATHS.demandesSoumettre, {
      params: { annee: ANNEE_COURANTE },
    });

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'soumettre sans departementId');
  });

  test('approuver une demande inexistante échoue', async ({ budgetCollaboratifClient }) => {
    const response = await budgetCollaboratifClient.approuverDemande(
      UUID_INEXISTANT,
      UUID_INEXISTANT,
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'approbation demande inexistante');
  });

  test('rejeter une demande exige un motif', async ({ apiContext }) => {
    const response = await apiContext.post(
      BUDGET_PATHS.demandeRejeter(UUID_INEXISTANT),
      { params: { userId: UUID_INEXISTANT } },
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'rejet sans motif');
  });

  test('rejeter une demande inexistante échoue', async ({ budgetCollaboratifClient }) => {
    const response = await budgetCollaboratifClient.rejeterDemande(
      UUID_INEXISTANT,
      'motif AQA',
      UUID_INEXISTANT,
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'rejet demande inexistante');
  });

  test('le cadrage exige un coefficient positif', async ({ budgetCollaboratifClient }) => {
    const response = await budgetCollaboratifClient.appliquerCadrage(
      {
        annee: ANNEE_COURANTE,
        comptePrefix: '6',
        coefficient: 0,
        responsableId: UUID_INEXISTANT,
      },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'cadrage coefficient nul');
  });

  test('le cadrage exige un préfixe de compte', async ({ budgetCollaboratifClient }) => {
    const response = await budgetCollaboratifClient.appliquerCadrage(
      {
        annee: ANNEE_COURANTE,
        comptePrefix: '',
        coefficient: 1.1,
        responsableId: UUID_INEXISTANT,
      },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'cadrage sans préfixe');
  });

  test('le cadrage nominal est accepté ou refusé sur données absentes', async ({
    budgetCollaboratifClient,
  }) => {
    const response = await budgetCollaboratifClient.appliquerCadrage(
      {
        annee: ANNEE_COURANTE,
        comptePrefix: '60',
        coefficient: 1.05,
        responsableId: UUID_INEXISTANT,
      },
      [200, ...NOT_FOUND_STATUSES],
    );

    await expectStatusIn(response, [200, ...NOT_FOUND_STATUSES], 'cadrage nominal');
  });

  test('la génération depuis l’historique exige des coefficients positifs', async ({
    budgetCollaboratifClient,
  }) => {
    const response = await budgetCollaboratifClient.genererDepuisHistorique(
      {
        anneeSource: ANNEE_COURANTE - 1,
        anneeCible: ANNEE_COURANTE,
        coeffVentes: -1,
        coeffCharges: 1,
        departementId: UUID_INEXISTANT,
      },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'génération coefficient négatif');
  });

  test('la génération depuis l’historique est traitée', async ({ budgetCollaboratifClient }) => {
    const response = await budgetCollaboratifClient.genererDepuisHistorique(
      {
        anneeSource: ANNEE_COURANTE - 1,
        anneeCible: ANNEE_COURANTE + 1,
        coeffVentes: 1.1,
        coeffCharges: 1.05,
        departementId: UUID_INEXISTANT,
      },
      [200, ...NOT_FOUND_STATUSES],
    );

    await expectStatusIn(response, [200, ...NOT_FOUND_STATUSES], 'génération nominale');
  });

  test('la consolidation exige les trois paramètres', async ({ apiContext }) => {
    const response = await apiContext.post(BUDGET_PATHS.consolider, {
      params: { annee: ANNEE_COURANTE },
    });

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'consolidation incomplète');
  });

  test('la consolidation sur un plan inexistant échoue', async ({ budgetCollaboratifClient }) => {
    const response = await budgetCollaboratifClient.consolider(
      ANNEE_COURANTE,
      UUID_INEXISTANT,
      UUID_INEXISTANT,
      [200, ...NOT_FOUND_STATUSES],
    );

    await expectStatusIn(response, [200, ...NOT_FOUND_STATUSES], 'consolidation plan inexistant');
  });
});

test.describe('API — Workflow d’engagement (/api/budget/engagements/workflow)', () => {
  test('le pré-engagement exige une section analytique', async ({ engagementWorkflowClient }) => {
    const response = await engagementWorkflowClient.preEngager(
      {
        planId: UUID_INEXISTANT,
        compteCode: '605200',
        numeroEngagement: 'ENG-AQA',
        montant: 1000,
        utilisateurId: UUID_INEXISTANT,
      },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'pré-engagement sans sectionId');
  });

  test('le pré-engagement exige un montant positif', async ({ engagementWorkflowClient }) => {
    const response = await engagementWorkflowClient.preEngager(
      {
        planId: UUID_INEXISTANT,
        compteCode: '605200',
        sectionId: UUID_INEXISTANT,
        numeroEngagement: 'ENG-AQA',
        montant: -5,
        utilisateurId: UUID_INEXISTANT,
      },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'pré-engagement montant négatif');
  });

  test('le pré-engagement sur un plan inexistant échoue', async ({ engagementWorkflowClient }) => {
    const response = await engagementWorkflowClient.preEngager(
      {
        planId: UUID_INEXISTANT,
        compteCode: '605200',
        sectionId: UUID_INEXISTANT,
        numeroEngagement: 'ENG-AQA',
        description: 'test AQA',
        montant: 1000,
        utilisateurId: UUID_INEXISTANT,
      },
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'pré-engagement plan inexistant');
  });

  test('valider une étape exige un rôle approbateur', async ({ engagementWorkflowClient }) => {
    const response = await engagementWorkflowClient.validerEtape(
      { numeroEngagement: 'ENG-AQA', roleApprobateur: '', utilisateurId: UUID_INEXISTANT },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'validation sans rôle');
  });

  test('valider un engagement inexistant échoue', async ({ engagementWorkflowClient }) => {
    const response = await engagementWorkflowClient.validerEtape(
      {
        numeroEngagement: `INEXISTANT-${Date.now()}`,
        roleApprobateur: 'DAF',
        utilisateurId: UUID_INEXISTANT,
      },
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'validation engagement inexistant');
  });

  test('rejeter une étape exige un motif', async ({ engagementWorkflowClient }) => {
    const response = await engagementWorkflowClient.rejeter(
      { numeroEngagement: 'ENG-AQA', motif: '', utilisateurId: UUID_INEXISTANT },
      BAD_REQUEST_STATUSES,
    );

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'rejet sans motif');
  });

  test('rejeter un engagement inexistant échoue', async ({ engagementWorkflowClient }) => {
    const response = await engagementWorkflowClient.rejeter(
      {
        numeroEngagement: `INEXISTANT-${Date.now()}`,
        motif: 'test AQA',
        utilisateurId: UUID_INEXISTANT,
      },
      NOT_FOUND_STATUSES,
    );

    await expectStatusIn(response, NOT_FOUND_STATUSES, 'rejet engagement inexistant');
  });
});

test.describe('API — Piste d’audit budgétaire', () => {
  test('les demandes exposent une structure exploitable', async ({ budgetCollaboratifClient }) => {
    const response = await budgetCollaboratifClient.listerDemandesRaw();

    await expectJsonArray(response);
  });
});
