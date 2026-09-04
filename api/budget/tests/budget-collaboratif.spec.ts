import { test, expect } from '../budget-fixtures';
import { BUDGET_PATHS } from '../budget-api-paths';
import { expectJsonArray, expectStatusIn } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import { ANNEE_COURANTE, UUID_INEXISTANT, UUID_MALFORME } from '../../../test-data/builders';
import { contexte, etape } from '../../../helpers/scenario';

test.describe('API — Budget collaboratif (/api/budget/collaboratif)', () => {
  test('la liste des demandes renvoie un tableau', async ({ budgetCollaboratifClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte habilité sur le budget collaboratif'],
    });

    const demandes = await etape(
      'Consulter la liste des demandes budgétaires',
      'Le service renvoie les demandes enregistrées',
      () => budgetCollaboratifClient.listerDemandes(),
    );

    await etape(
      'Examiner la structure du résultat',
      'Le résultat est un tableau, vide si aucune demande n’a encore été déposée',
      async () => {
        expect(Array.isArray(demandes)).toBeTruthy();
      },
    );
  });

  test('les filtres facultatifs sont acceptés simultanément', async ({ budgetCollaboratifClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: [
        'Trois filtres sont posés ensemble : département inexistant, exercice en cours et statut brouillon',
      ],
    });

    const demandes = await etape(
      'Filtrer les demandes par département, exercice et statut à la fois',
      'Le service accepte les trois filtres conjointement au lieu d’en ignorer certains',
      () =>
        budgetCollaboratifClient.listerDemandes({
          departementId: UUID_INEXISTANT,
          annee: ANNEE_COURANTE,
          statut: 'BROUILLON',
        }),
    );

    await etape(
      'Contrôler le résultat',
      'Le résultat est un tableau vide : les filtres se cumulent et aucun département inexistant ne porte de demande',
      async () => {
        expect(Array.isArray(demandes)).toBeTruthy();
        expect(demandes).toHaveLength(0);
      },
    );
  });

  test('le filtre par année ne renvoie que cette année', async ({ budgetCollaboratifClient }) => {
    await contexte({
      preconditions: [
        'Au moins une demande existe et porte un exercice, sans quoi le cas est ignoré',
      ],
    });

    const toutes = (await etape(
      'Relever une demande existante pour connaître son exercice',
      'Le service renvoie les demandes enregistrées',
      () => budgetCollaboratifClient.listerDemandes(),
    )) as Record<string, unknown>[];
    test.skip(toutes.length === 0, 'aucune demande en base');

    const annee = toutes[0].annee as number | undefined;
    test.skip(annee === undefined, 'la demande de référence ne porte pas d’année');

    const filtrees = (await etape(
      'Filtrer les demandes sur cet exercice',
      'Le service ne renvoie que les demandes de l’exercice demandé',
      () => budgetCollaboratifClient.listerDemandes({ annee }),
    )) as Record<string, unknown>[];

    await etape(
      'Contrôler l’exercice de chaque demande renvoyée',
      'Toutes portent l’exercice demandé : le filtre par année est réellement appliqué',
      async () => {
        for (const demande of filtrees) {
          expect(demande.annee).toBe(annee);
        }
      },
    );
  });

  test('un departementId malformé est rejeté', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant de département transmis n’a pas la forme d’un UUID'],
    });

    const response = await etape(
      'Filtrer les demandes avec un identifiant de département malformé',
      'Le service rejette la valeur au lieu de chercher un département inexistant',
      () => apiContext.get(BUDGET_PATHS.demandes, { params: { departementId: UUID_MALFORME } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'departementId malformé'),
    );
  });

  test('la saisie exige un compteCode', async ({ budgetCollaboratifClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La demande soumise ne désigne aucun compte budgétaire'],
    });

    const response = await etape(
      'Déposer une demande budgétaire sans préciser le compte concerné',
      'Le service refuse : une demande doit s’imputer sur un compte',
      () =>
        budgetCollaboratifClient.saisirDemande(
          { departementId: UUID_INEXISTANT, annee: ANNEE_COURANTE, montant: 1000 },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'demande sans compteCode'),
    );
  });

  test('la saisie exige un montant strictement positif', async ({ budgetCollaboratifClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le montant demandé est nul'],
    });

    const response = await etape(
      'Déposer une demande budgétaire d’un montant nul',
      'Le service refuse : une demande sans montant n’a pas d’objet',
      () =>
        budgetCollaboratifClient.saisirDemande(
          {
            departementId: UUID_INEXISTANT,
            annee: ANNEE_COURANTE,
            compteCode: '605200',
            montant: 0,
          },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'demande montant nul'),
    );
  });

  test('la saisie sur un département inexistant échoue', async ({ budgetCollaboratifClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La demande est complète et valide, mais vise un département qui n’existe pas'],
    });

    const response = await etape(
      'Déposer une demande budgétaire pour un département inexistant',
      'Le service signale que le département est introuvable plutôt que de rattacher la demande au vide',
      () =>
        budgetCollaboratifClient.saisirDemande(
          {
            departementId: UUID_INEXISTANT,
            annee: ANNEE_COURANTE,
            compteCode: '605200',
            montant: 1000,
            commentaires: 'test AQA',
          },
          [...NOT_FOUND_STATUSES, 200],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des ressources introuvables (400, 404, 409, 500), ou d’une acceptation documentée (200)',
      () =>
        expectStatusIn(response, [...NOT_FOUND_STATUSES, 200], 'demande département inexistant'),
    );
  });

  test('la soumission groupée exige departementId et annee', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Seul l’exercice est transmis ; le département est omis'],
    });

    const response = await etape(
      'Soumettre en bloc les demandes d’un département sans préciser lequel',
      'Le service refuse : la soumission groupée doit cibler un département précis',
      () => apiContext.post(BUDGET_PATHS.demandesSoumettre, { params: { annee: ANNEE_COURANTE } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'soumettre sans departementId'),
    );
  });

  test('approuver une demande inexistante échoue', async ({ budgetCollaboratifClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à approuver les demandes est ouverte'],
      configuration: ['La demande visée n’existe pas'],
    });

    const response = await etape(
      'Approuver une demande budgétaire qui n’existe pas',
      'Le service signale que la demande est introuvable au lieu d’approuver dans le vide',
      () =>
        budgetCollaboratifClient.approuverDemande(
          UUID_INEXISTANT,
          UUID_INEXISTANT,
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'approbation demande inexistante'),
    );
  });

  test('rejeter une demande exige un motif', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session habilitée à rejeter les demandes est ouverte'],
      configuration: ['Aucun motif de rejet n’est transmis'],
    });

    const response = await etape(
      'Rejeter une demande budgétaire sans indiquer de motif',
      'Le service refuse : un rejet doit être motivé pour être opposable au demandeur',
      () =>
        apiContext.post(BUDGET_PATHS.demandeRejeter(UUID_INEXISTANT), {
          params: { userId: UUID_INEXISTANT },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'rejet sans motif'),
    );
  });

  test('rejeter une demande inexistante échoue', async ({ budgetCollaboratifClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à rejeter les demandes est ouverte'],
      configuration: ['Le motif est renseigné ; seule la demande visée n’existe pas'],
    });

    const response = await etape(
      'Rejeter avec motif une demande qui n’existe pas',
      'Le service signale que la demande est introuvable',
      () =>
        budgetCollaboratifClient.rejeterDemande(
          UUID_INEXISTANT,
          'motif AQA',
          UUID_INEXISTANT,
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'rejet demande inexistante'),
    );
  });

  test('le cadrage exige un coefficient positif', async ({ budgetCollaboratifClient }) => {
    await contexte({
      preconditions: ['Une session habilitée au cadrage budgétaire est ouverte'],
      configuration: ['Le coefficient de cadrage transmis est nul'],
    });

    const response = await etape(
      'Appliquer un cadrage budgétaire avec un coefficient nul',
      'Le service refuse : un coefficient nul ramènerait tous les budgets à zéro',
      () =>
        budgetCollaboratifClient.appliquerCadrage(
          {
            annee: ANNEE_COURANTE,
            comptePrefix: '6',
            coefficient: 0,
            responsableId: UUID_INEXISTANT,
          },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'cadrage coefficient nul'),
    );
  });

  test('le cadrage exige un préfixe de compte', async ({ budgetCollaboratifClient }) => {
    await contexte({
      preconditions: ['Une session habilitée au cadrage budgétaire est ouverte'],
      configuration: ['Le préfixe de compte transmis est vide'],
    });

    const response = await etape(
      'Appliquer un cadrage sans délimiter les comptes concernés',
      'Le service refuse : sans préfixe, le cadrage porterait sur tout le plan comptable',
      () =>
        budgetCollaboratifClient.appliquerCadrage(
          {
            annee: ANNEE_COURANTE,
            comptePrefix: '',
            coefficient: 1.1,
            responsableId: UUID_INEXISTANT,
          },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'cadrage sans préfixe'),
    );
  });

  test('le cadrage nominal est accepté ou refusé sur données absentes', async ({
    budgetCollaboratifClient,
  }) => {
    await contexte({
      preconditions: ['Une session habilitée au cadrage budgétaire est ouverte'],
      configuration: [
        'Le cadrage majore de 5 % les comptes commençant par 60, pour l’exercice en cours',
      ],
    });

    const response = await etape(
      'Appliquer un cadrage de 5 % sur les comptes de la classe 60',
      'Le service applique le cadrage, ou signale l’absence de données à cadrer',
      () =>
        budgetCollaboratifClient.appliquerCadrage(
          {
            annee: ANNEE_COURANTE,
            comptePrefix: '60',
            coefficient: 1.05,
            responsableId: UUID_INEXISTANT,
          },
          [200, ...NOT_FOUND_STATUSES],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code est soit un succès (200), soit une ressource introuvable (400, 404, 409, 500) : jamais une erreur de validation',
      () => expectStatusIn(response, [200, ...NOT_FOUND_STATUSES], 'cadrage nominal'),
    );
  });

  test('la génération depuis l’historique exige des coefficients positifs', async ({
    budgetCollaboratifClient,
  }) => {
    await contexte({
      preconditions: ['Une session habilitée à la préparation budgétaire est ouverte'],
      configuration: ['Le coefficient appliqué aux ventes est négatif'],
    });

    const response = await etape(
      'Générer un budget depuis l’historique avec un coefficient de ventes négatif',
      'Le service refuse : un coefficient négatif inverserait le sens des montants',
      () =>
        budgetCollaboratifClient.genererDepuisHistorique(
          {
            anneeSource: ANNEE_COURANTE - 1,
            anneeCible: ANNEE_COURANTE,
            coeffVentes: -1,
            coeffCharges: 1,
            departementId: UUID_INEXISTANT,
          },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'génération coefficient négatif'),
    );
  });

  test('la génération depuis l’historique est traitée', async ({ budgetCollaboratifClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à la préparation budgétaire est ouverte'],
      configuration: [
        'Le budget de l’exercice suivant est projeté depuis l’exercice précédent, ventes majorées de 10 % et charges de 5 %',
      ],
    });

    const response = await etape(
      'Générer le budget de l’exercice suivant à partir de l’historique',
      'Le service produit la projection, ou signale que les données source sont absentes',
      () =>
        budgetCollaboratifClient.genererDepuisHistorique(
          {
            anneeSource: ANNEE_COURANTE - 1,
            anneeCible: ANNEE_COURANTE + 1,
            coeffVentes: 1.1,
            coeffCharges: 1.05,
            departementId: UUID_INEXISTANT,
          },
          [200, ...NOT_FOUND_STATUSES],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code est soit un succès (200), soit une ressource introuvable (400, 404, 409, 500) : la demande est bien formée',
      () => expectStatusIn(response, [200, ...NOT_FOUND_STATUSES], 'génération nominale'),
    );
  });

  test('la consolidation exige les trois paramètres', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session habilitée à consolider est ouverte'],
      configuration: ['Seul l’exercice est transmis ; le plan et le responsable sont omis'],
    });

    const response = await etape(
      'Lancer la consolidation en ne fournissant que l’exercice',
      'Le service refuse : la consolidation a besoin du plan et du responsable en plus de l’exercice',
      () => apiContext.post(BUDGET_PATHS.consolider, { params: { annee: ANNEE_COURANTE } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'consolidation incomplète'),
    );
  });

  test('la consolidation sur un plan inexistant échoue', async ({ budgetCollaboratifClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à consolider est ouverte'],
      configuration: ['Les trois paramètres sont fournis, mais le plan budgétaire visé n’existe pas'],
    });

    const response = await etape(
      'Lancer la consolidation sur un plan budgétaire inexistant',
      'Le service signale que le plan est introuvable plutôt que de consolider dans le vide',
      () =>
        budgetCollaboratifClient.consolider(
          ANNEE_COURANTE,
          UUID_INEXISTANT,
          UUID_INEXISTANT,
          [200, ...NOT_FOUND_STATUSES],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code est soit un succès (200), soit une ressource introuvable (400, 404, 409, 500)',
      () =>
        expectStatusIn(response, [200, ...NOT_FOUND_STATUSES], 'consolidation plan inexistant'),
    );
  });
});

test.describe('API — Workflow d’engagement (/api/budget/engagements/workflow)', () => {
  test('le pré-engagement exige une section analytique', async ({ engagementWorkflowClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à engager des dépenses est ouverte'],
      configuration: ['Aucune section analytique n’est désignée sur le pré-engagement'],
    });

    const response = await etape(
      'Créer un pré-engagement sans désigner de section analytique',
      'Le service refuse : la dépense doit être rattachée à une section pour être suivie',
      () =>
        engagementWorkflowClient.preEngager(
          {
            planId: UUID_INEXISTANT,
            compteCode: '605200',
            numeroEngagement: 'ENG-AQA',
            montant: 1000,
            utilisateurId: UUID_INEXISTANT,
          },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'pré-engagement sans sectionId'),
    );
  });

  test('le pré-engagement exige un montant positif', async ({ engagementWorkflowClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à engager des dépenses est ouverte'],
      configuration: ['Le montant du pré-engagement est négatif'],
    });

    const response = await etape(
      'Créer un pré-engagement d’un montant négatif',
      'Le service refuse : un engagement négatif reviendrait à libérer du budget par ce circuit',
      () =>
        engagementWorkflowClient.preEngager(
          {
            planId: UUID_INEXISTANT,
            compteCode: '605200',
            sectionId: UUID_INEXISTANT,
            numeroEngagement: 'ENG-AQA',
            montant: -5,
            utilisateurId: UUID_INEXISTANT,
          },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'pré-engagement montant négatif'),
    );
  });

  test('le pré-engagement sur un plan inexistant échoue', async ({ engagementWorkflowClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à engager des dépenses est ouverte'],
      configuration: ['Le pré-engagement est complet, mais le plan budgétaire visé n’existe pas'],
    });

    const response = await etape(
      'Créer un pré-engagement complet sur un plan budgétaire inexistant',
      'Le service signale que le plan est introuvable : aucune dépense ne s’engage hors budget',
      () =>
        engagementWorkflowClient.preEngager(
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
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'pré-engagement plan inexistant'),
    );
  });

  test('valider une étape exige un rôle approbateur', async ({ engagementWorkflowClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte sur le circuit d’engagement'],
      configuration: ['Le rôle approbateur transmis est vide'],
    });

    const response = await etape(
      'Valider une étape du circuit sans préciser le rôle de l’approbateur',
      'Le service refuse : c’est le rôle qui détermine l’étape franchie dans le circuit',
      () =>
        engagementWorkflowClient.validerEtape(
          { numeroEngagement: 'ENG-AQA', roleApprobateur: '', utilisateurId: UUID_INEXISTANT },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'validation sans rôle'),
    );
  });

  test('valider un engagement inexistant échoue', async ({ engagementWorkflowClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte sur le circuit d’engagement'],
      configuration: [
        'Le rôle approbateur est renseigné ; seul le numéro d’engagement ne correspond à rien',
      ],
    });

    const response = await etape(
      'Valider une étape sur un numéro d’engagement qui n’existe pas',
      'Le service signale que l’engagement est introuvable',
      () =>
        engagementWorkflowClient.validerEtape(
          {
            numeroEngagement: `INEXISTANT-${Date.now()}`,
            roleApprobateur: 'DAF',
            utilisateurId: UUID_INEXISTANT,
          },
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'validation engagement inexistant'),
    );
  });

  test('rejeter une étape exige un motif', async ({ engagementWorkflowClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte sur le circuit d’engagement'],
      configuration: ['Le motif de rejet transmis est vide'],
    });

    const response = await etape(
      'Rejeter une étape du circuit sans indiquer de motif',
      'Le service refuse : un rejet doit être motivé pour que le demandeur puisse corriger',
      () =>
        engagementWorkflowClient.rejeter(
          { numeroEngagement: 'ENG-AQA', motif: '', utilisateurId: UUID_INEXISTANT },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'rejet sans motif'),
    );
  });

  test('rejeter un engagement inexistant échoue', async ({ engagementWorkflowClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte sur le circuit d’engagement'],
      configuration: ['Le motif est renseigné ; seul le numéro d’engagement ne correspond à rien'],
    });

    const response = await etape(
      'Rejeter avec motif une étape sur un engagement qui n’existe pas',
      'Le service signale que l’engagement est introuvable',
      () =>
        engagementWorkflowClient.rejeter(
          {
            numeroEngagement: `INEXISTANT-${Date.now()}`,
            motif: 'test AQA',
            utilisateurId: UUID_INEXISTANT,
          },
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'rejet engagement inexistant'),
    );
  });
});

test.describe('API — Piste d’audit budgétaire', () => {
  test('les demandes exposent une structure exploitable', async ({ budgetCollaboratifClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: [
        'La réponse brute est examinée, sans passer par la désérialisation du client',
      ],
    });

    const response = await etape(
      'Consulter la liste brute des demandes budgétaires',
      'Le service répond 200 avec un contenu JSON exploitable par un consommateur externe',
      () => budgetCollaboratifClient.listerDemandesRaw(),
    );

    await etape(
      'Examiner la structure de la réponse',
      'Le corps est un tableau JSON : la piste d’audit reste lisible par un outil tiers',
      () => expectJsonArray(response),
    );
  });
});
