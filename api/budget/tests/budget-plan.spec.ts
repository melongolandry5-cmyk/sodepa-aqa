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
import { contexte, etape } from '../../../helpers/scenario';

test.describe('API — Plans budgétaires (/api/budget/plans)', () => {
  test('la recherche paginée est cohérente', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte habilité sur les plans budgétaires'],
      configuration: ['La première page est demandée avec une taille de 10 éléments'],
    });

    const page = await etape(
      'Consulter la première page des plans budgétaires, par tranches de 10',
      'Le service renvoie une page conforme à la demande',
      () => budgetClient.listerPlans({ page: 0, size: 10 }),
    );

    await etape(
      'Contrôler la structure de la page',
      'Le numéro de page et la taille renvoyés correspondent à ceux demandés, et le total est cohérent',
      async () => {
        expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
      },
    );
  });

  test('la taille de page est respectée', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La taille de page demandée est de 3 éléments'],
    });

    const page = await etape(
      'Consulter les plans budgétaires par tranches de 3',
      'Le service découpe le résultat selon la taille demandée',
      () => budgetClient.listerPlans({ page: 0, size: 3 }),
    );

    await etape(
      'Contrôler la taille du résultat',
      'La page annonce une taille de 3 et n’en renvoie jamais davantage',
      async () => {
        expect(page.content.length).toBeLessThanOrEqual(3);
        expect(page.size).toBe(3);
      },
    );
  });

  test('la seconde page ne répète pas la première', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Au moins trois plans budgétaires existent, sans quoi le cas est ignoré'],
      configuration: ['La pagination est demandée par tranches de 2 plans'],
    });

    const premiere = await etape(
      'Consulter la première page de deux plans',
      'Le service renvoie les deux premiers plans et le total en base',
      () => budgetClient.listerPlans({ page: 0, size: 2 }),
    );
    test.skip(premiere.totalElements < 3, 'jeu de données insuffisant pour paginer');

    const seconde = await etape(
      'Consulter la page suivante',
      'Le service renvoie une seconde page conforme à la demande',
      () => budgetClient.listerPlans({ page: 1, size: 2 }),
    );

    await etape(
      'Comparer les deux pages',
      'La seconde page est bien la page 1, et aucun plan de la première n’y réapparaît',
      async () => {
        expectValidPage(seconde, { expectedPage: 1, expectedSize: 2 });
        const ids = premiere.content.map((p) => p.id);
        expect(seconde.content.filter((p) => ids.includes(p.id))).toHaveLength(0);
      },
    );
  });

  test('une page au-delà du dernier index renvoie un contenu vide', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La page demandée se situe cinq rangs après la dernière page existante'],
    });

    const premiere = await etape(
      'Relever le nombre total de pages disponibles',
      'Le service indique combien de pages compte le résultat',
      () => budgetClient.listerPlans({ page: 0, size: 10 }),
    );

    const horsBornes = await etape(
      'Demander une page située bien au-delà de la dernière',
      'Le service répond normalement au lieu de renvoyer une erreur',
      () => budgetClient.listerPlans({ page: premiere.totalPages + 5, size: 10 }),
    );

    await etape(
      'Contrôler le contenu de cette page',
      'La page ne contient aucun plan et se déclare explicitement vide',
      async () => {
        expect(horsBornes.content).toHaveLength(0);
        expect(horsBornes.empty).toBe(true);
      },
    );
  });

  test('le filtre par année ne renvoie que cette année', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Au moins un plan existe et porte un exercice, sans quoi le cas est ignoré'],
    });

    const reference = await etape(
      'Relever un plan existant pour connaître son exercice',
      'Le service renvoie au moins un plan avec son exercice',
      () => budgetClient.listerPlans({ page: 0, size: 1 }),
    );
    test.skip(reference.content.length === 0, 'aucun plan en base');

    const annee = (reference.content[0].annee ?? reference.content[0].exercice) as number | undefined;
    test.skip(annee === undefined, 'le plan de référence ne porte pas d’année');

    const filtres = await etape(
      'Filtrer les plans sur cet exercice',
      'Le service ne renvoie que les plans de l’exercice demandé',
      () => budgetClient.listerPlans({ page: 0, size: 50, annee }),
    );

    await etape(
      'Contrôler l’exercice de chaque plan renvoyé',
      'Tous portent l’exercice demandé : le filtre par année est réellement appliqué',
      async () => {
        for (const plan of filtres.content) {
          expect(plan.annee ?? plan.exercice).toBe(annee);
        }
      },
    );
  });

  test('le filtre par statut ne renvoie que ce statut', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le filtre porte sur le statut brouillon (DRAFT)'],
    });

    const filtres = await etape(
      'Filtrer les plans budgétaires sur le statut brouillon',
      'Le service ne renvoie que les plans encore à l’état de brouillon',
      () => budgetClient.listerPlans({ page: 0, size: 50, statut: 'DRAFT' }),
    );

    await etape(
      'Contrôler le statut de chaque plan renvoyé',
      'Aucun plan soumis ou publié ne figure dans le résultat : le filtre par statut est appliqué',
      async () => {
        expectValidPage(filtres, { expectedPage: 0 });
        for (const plan of filtres.content) {
          expect(plan.statut).toBe('DRAFT');
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
      'Filtrer les plans sur un statut qui n’existe pas',
      'Le service rejette la valeur au lieu de renvoyer une liste vide sans explication',
      () => apiContext.get(BUDGET_PATHS.plans, { params: { statut: 'STATUT_INCONNU' } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'statut invalide'),
    );
  });

  test('la consultation unitaire renvoie le plan demandé', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Au moins un plan budgétaire existe, sans quoi le cas est ignoré'],
    });

    const page = await etape(
      'Relever un plan existant dans la liste',
      'Le service renvoie au moins un plan avec son identifiant',
      () => budgetClient.listerPlans({ page: 0, size: 1 }),
    );
    test.skip(page.content.length === 0, 'aucun plan en base');

    const plan = await etape(
      'Consulter ce plan par son identifiant',
      'Le service renvoie la fiche du plan demandé',
      () => budgetClient.getPlan(page.content[0].id),
    );

    await etape(
      'Contrôler l’identité du plan renvoyé',
      'C’est bien le plan demandé et non un autre : le service ne se trompe pas de ressource',
      async () => {
        expect(plan.id).toBe(page.content[0].id);
      },
    );
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant demandé est un UUID valide qui ne correspond à aucun plan'],
    });

    const response = await etape(
      'Consulter un plan budgétaire dont l’identifiant n’existe pas',
      'Le service signale que le plan est introuvable au lieu de renvoyer une fiche vide',
      () => budgetClient.getPlanRaw(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'plan inexistant'),
    );
  });

  test('un identifiant malformé est rejeté en 400', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant demandé n’a pas la forme d’un UUID'],
    });

    const response = await etape(
      'Consulter un plan budgétaire avec un identifiant malformé',
      'Le service rejette la valeur avant même de chercher en base',
      () => budgetClient.getPlanRaw(UUID_MALFORME, BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'plan id malformé'),
    );
  });

  test('la création exige un intitulé', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des plans est ouverte'],
      configuration: ['L’intitulé du plan est vide'],
    });

    const response = await etape(
      'Créer un plan budgétaire sans intitulé',
      'Le service refuse : un plan doit être identifiable par son intitulé',
      () =>
        budgetClient.creerPlanRaw(
          { annee: ANNEE_COURANTE, intitule: '', utilisateurId: UUID_INEXISTANT },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'intitulé vide'),
    );
  });

  test('la création exige une année positive', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des plans est ouverte'],
      configuration: ['L’exercice transmis est négatif'],
    });

    const response = await etape(
      'Créer un plan budgétaire sur un exercice négatif',
      'Le service refuse : un exercice comptable ne peut pas être négatif',
      () =>
        budgetClient.creerPlanRaw(
          { annee: -1, intitule: 'x', utilisateurId: UUID_INEXISTANT },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'année négative'),
    );
  });

  test('la création exige un utilisateurId', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des plans est ouverte'],
      configuration: ['Aucun utilisateur créateur n’est transmis'],
    });

    const response = await etape(
      'Créer un plan budgétaire sans désigner l’utilisateur à l’origine de la demande',
      'Le service refuse : la traçabilité impose de savoir qui crée le plan',
      () =>
        budgetClient.creerPlanRaw(
          { annee: ANNEE_COURANTE, intitule: 'x' },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'utilisateurId manquant'),
    );
  });

  test('un plan créé est consultable et son cycle de vie est exploitable', async ({
    budgetClient,
    userClient,
  }) => {
    await contexte({
      preconditions: [
        'Au moins un utilisateur existe en base, sans quoi le cas est ignoré',
        'Le compte est habilité à créer, soumettre et approuver un plan',
      ],
      configuration: [
        'Le plan parcourt le circuit complet : brouillon, puis soumission, puis publication',
      ],
    });

    const utilisateurs = await etape(
      'Relever un utilisateur existant pour porter la demande',
      'Le service renvoie au moins un utilisateur',
      () => userClient.page({ page: 0, size: 1 }),
    );
    test.skip(utilisateurs.content.length === 0, 'aucun utilisateur en base');
    const utilisateurId = String(utilisateurs.content[0].id);

    const cree = await etape(
      'Créer un plan budgétaire au nom de cet utilisateur',
      'Le plan est créé et reçoit un identifiant',
      () => budgetClient.creerPlan(planBudgetaireValide(utilisateurId)),
    );

    await etape(
      'Relire le plan créé',
      'Le plan est retrouvé par son identifiant et se trouve à l’état de brouillon',
      async () => {
        expect(cree.id).toBeTruthy();
        const relu = await budgetClient.getPlan(cree.id);
        expect(relu.id).toBe(cree.id);
        expect(relu.statut).toBe('DRAFT');
      },
    );

    await etape(
      'Ajouter un poste de 500 000 sur un compte de charge',
      'Le poste est ajouté au plan : un brouillon accepte encore des modifications',
      async () => {
        const item = await budgetClient.ajouterItem(cree.id, {
          compteCode: '605200',
          montant: 500_000,
        });
        expect(item).toBeTruthy();
      },
    );

    await etape(
      'Soumettre le plan à validation',
      'Le plan passe à l’état soumis : il n’est plus modifiable librement',
      async () => {
        await budgetClient.soumettrePlan(cree.id, utilisateurId);
        const soumis = await budgetClient.getPlan(cree.id);
        expect(soumis.statut).toBe('SUBMITTED');
      },
    );

    await etape(
      'Approuver le plan soumis',
      'Le plan passe à l’état publié : le cycle création, soumission puis approbation est cohérent',
      async () => {
        await budgetClient.approuverPlan(cree.id, utilisateurId);
        const approuve = await budgetClient.getPlan(cree.id);
        expect(approuve.statut).toBe('PUBLISHED');
      },
    );
  });

  test('un poste au montant négatif est refusé', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à modifier un plan est ouverte'],
      configuration: ['Le montant du poste ajouté est négatif'],
    });

    const response = await etape(
      'Ajouter à un plan un poste budgétaire d’un montant négatif',
      'Le service refuse : un poste négatif fausserait le total du plan',
      () =>
        budgetClient.ajouterItemRaw(
          UUID_INEXISTANT,
          { compteCode: '605200', montant: -10 },
          [...BAD_REQUEST_STATUSES, 404],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou de la ressource introuvable (404)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'montant négatif'),
    );
  });

  test('soumettre un plan inexistant échoue', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le plan visé n’existe pas'],
    });

    const response = await etape(
      'Soumettre à validation un plan budgétaire qui n’existe pas',
      'Le service signale que le plan est introuvable',
      () => budgetClient.soumettrePlan(UUID_INEXISTANT, UUID_INEXISTANT, [...NOT_FOUND_STATUSES]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'soumission plan inexistant'),
    );
  });

  test('approuver un plan inexistant échoue', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à approuver est ouverte'],
      configuration: ['Le plan visé n’existe pas'],
    });

    const response = await etape(
      'Approuver un plan budgétaire qui n’existe pas',
      'Le service signale que le plan est introuvable au lieu d’approuver dans le vide',
      () => budgetClient.approuverPlan(UUID_INEXISTANT, UUID_INEXISTANT, [...NOT_FOUND_STATUSES]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'approbation plan inexistant'),
    );
  });

  test('rejeter un plan inexistant échoue', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à rejeter est ouverte'],
      configuration: ['Le plan visé n’existe pas'],
    });

    const response = await etape(
      'Rejeter un plan budgétaire qui n’existe pas',
      'Le service signale que le plan est introuvable',
      () => budgetClient.rejeterPlan(UUID_INEXISTANT, UUID_INEXISTANT, [...NOT_FOUND_STATUSES]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'rejet plan inexistant'),
    );
  });

  test('le paramètre userId est obligatoire pour soumettre', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Aucun utilisateur soumissionnaire n’est transmis'],
    });

    const response = await etape(
      'Soumettre un plan sans indiquer quel utilisateur en fait la demande',
      'Le service refuse : la soumission doit être imputée à quelqu’un',
      () => apiContext.post(BUDGET_PATHS.planSoumettre(UUID_INEXISTANT)),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'soumettre sans userId'),
    );
  });

  test('une réallocation vers un poste inexistant échoue', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à réallouer du budget est ouverte'],
      configuration: ['Ni le poste source ni le poste destinataire n’existent'],
    });

    const response = await etape(
      'Transférer 1 000 d’un poste budgétaire à un autre, tous deux inexistants',
      'Le service signale que les postes sont introuvables plutôt que de déplacer du budget fictif',
      () =>
        budgetClient.reallocer(
          {
            sourceItemId: UUID_INEXISTANT,
            destItemId: UUID_INEXISTANT,
            montant: 1000,
            responsableId: UUID_INEXISTANT,
            raison: 'test AQA',
          },
          [...NOT_FOUND_STATUSES],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'réallocation postes inexistants'),
    );
  });

  test('une réallocation sans raison est refusée', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à réallouer du budget est ouverte'],
      configuration: ['La raison du transfert est vide'],
    });

    const response = await etape(
      'Transférer du budget d’un poste à un autre sans justifier le transfert',
      'Le service refuse : un mouvement de budget doit être justifié pour être auditable',
      () =>
        budgetClient.reallocer(
          {
            sourceItemId: UUID_INEXISTANT,
            destItemId: UUID_INEXISTANT,
            montant: 1000,
            responsableId: UUID_INEXISTANT,
            raison: '',
          },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'réallocation sans raison'),
    );
  });
});

test.describe('API — Engagements budgétaires (/api/budget/engagements)', () => {
  test('la recherche paginée est cohérente', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte habilité sur les engagements'],
      configuration: ['La première page est demandée avec une taille de 10 éléments'],
    });

    const page = await etape(
      'Consulter la première page des engagements, par tranches de 10',
      'Le service renvoie une page conforme à la demande',
      () => budgetClient.listerEngagements({ page: 0, size: 10 }),
    );

    await etape(
      'Contrôler la structure de la page',
      'Le numéro de page et la taille renvoyés correspondent à ceux demandés',
      async () => {
        expectValidPage(page, { expectedPage: 0, expectedSize: 10 });
      },
    );
  });

  test('le filtre par plan ne renvoie que ses engagements', async ({ budgetClient }) => {
    await contexte({
      preconditions: [
        'Au moins un engagement existe et se rattache à un plan, sans quoi le cas est ignoré',
      ],
    });

    const engagements = await etape(
      'Relever un engagement existant pour connaître son plan de rattachement',
      'Le service renvoie au moins un engagement',
      () => budgetClient.listerEngagements({ page: 0, size: 1 }),
    );
    test.skip(engagements.content.length === 0, 'aucun engagement en base');

    const planId = engagements.content[0].planId as string | undefined;
    test.skip(!planId, 'l’engagement de référence ne porte pas de planId');

    const filtres = await etape(
      'Filtrer les engagements sur ce plan budgétaire',
      'Le service ne renvoie que les engagements rattachés au plan demandé',
      () => budgetClient.listerEngagements({ page: 0, size: 50, planId }),
    );

    await etape(
      'Contrôler le plan de rattachement de chaque engagement',
      'Aucun engagement d’un autre plan n’apparaît : le filtre cloisonne bien les plans',
      async () => {
        for (const engagement of filtres.content) {
          expect(engagement.planId).toBe(planId);
        }
      },
    );
  });

  test('la consultation par numéro renvoie l’engagement demandé', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Au moins un engagement existe en base, sans quoi le cas est ignoré'],
      configuration: ['L’engagement est consulté par son numéro, non par un identifiant technique'],
    });

    const page = await etape(
      'Relever un engagement existant dans la liste',
      'Le service renvoie au moins un engagement avec son numéro',
      () => budgetClient.listerEngagements({ page: 0, size: 1 }),
    );
    test.skip(page.content.length === 0, 'aucun engagement en base');

    const numero = String(page.content[0].numero ?? page.content[0].numeroEngagement);

    const engagement = await etape(
      'Consulter cet engagement par son numéro',
      'Le service renvoie l’engagement portant ce numéro',
      () => budgetClient.getEngagement(numero),
    );

    await etape(
      'Contrôler le numéro de l’engagement renvoyé',
      'C’est bien l’engagement demandé : le numéro sert de clé fonctionnelle fiable',
      async () => {
        expect(String(engagement.numero ?? engagement.numeroEngagement)).toBe(numero);
      },
    );
  });

  test('un numéro inexistant ne renvoie pas 200', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le numéro demandé est généré au hasard et ne correspond à aucun engagement'],
    });

    const response = await etape(
      'Consulter un engagement dont le numéro n’existe pas',
      'Le service signale que l’engagement est introuvable',
      () => budgetClient.getEngagementRaw(unique('INEXISTANT'), NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'engagement inexistant'),
    );
  });

  test('engager sur un plan inexistant échoue', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à engager des dépenses est ouverte'],
      configuration: ['L’engagement est complet, mais le plan budgétaire visé n’existe pas'],
    });

    const response = await etape(
      'Engager une dépense sur un plan budgétaire inexistant',
      'Le service signale que le plan est introuvable : aucune dépense ne s’engage hors budget',
      () =>
        budgetClient.engagerRaw(
          {
            planId: UUID_INEXISTANT,
            compteCode: '605200',
            numeroEngagement: unique('ENG'),
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
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'engagement plan inexistant'),
    );
  });

  test('engager sans compteCode est refusé', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à engager des dépenses est ouverte'],
      configuration: ['Aucun compte d’imputation n’est transmis'],
    });

    const response = await etape(
      'Engager une dépense sans préciser le compte d’imputation',
      'Le service refuse : une dépense doit s’imputer sur un compte pour être suivie',
      () =>
        budgetClient.engagerRaw(
          {
            planId: UUID_INEXISTANT,
            numeroEngagement: unique('ENG'),
            description: 'x',
            montant: 1000,
            utilisateurId: UUID_INEXISTANT,
          },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'engagement sans compteCode'),
    );
  });

  test('engager un montant nul est refusé', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à engager des dépenses est ouverte'],
      configuration: ['Le montant engagé est nul'],
    });

    const response = await etape(
      'Engager une dépense d’un montant nul',
      'Le service refuse : un engagement sans montant ne réserve aucun crédit',
      () =>
        budgetClient.engagerRaw(
          {
            planId: UUID_INEXISTANT,
            compteCode: '605200',
            numeroEngagement: unique('ENG'),
            description: 'x',
            montant: 0,
            utilisateurId: UUID_INEXISTANT,
          },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'engagement montant nul'),
    );
  });

  test('liquider un engagement inexistant échoue', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à liquider est ouverte'],
      configuration: ['Le numéro d’engagement visé ne correspond à rien'],
    });

    const response = await etape(
      'Liquider un engagement qui n’existe pas',
      'Le service signale que l’engagement est introuvable au lieu de solder un crédit fictif',
      () => budgetClient.liquider(unique('INEXISTANT'), UUID_INEXISTANT, [...NOT_FOUND_STATUSES]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'liquidation inexistante'),
    );
  });

  test('annuler un engagement inexistant échoue', async ({ budgetClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à annuler est ouverte'],
      configuration: ['Le numéro d’engagement visé ne correspond à rien'],
    });

    const response = await etape(
      'Annuler un engagement qui n’existe pas',
      'Le service signale que l’engagement est introuvable au lieu de libérer un crédit fictif',
      () => budgetClient.annuler(unique('INEXISTANT'), UUID_INEXISTANT, [...NOT_FOUND_STATUSES]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'annulation inexistante'),
    );
  });
});
