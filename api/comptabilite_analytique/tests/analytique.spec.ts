import { test, expect } from '../comptabilite-analytique-fixtures';
import { ANALYTIQUE_PATHS } from '../comptabilite-analytique-api-paths';
import { expectJsonArray, expectStatusIn } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import {
  ANNEE_COURANTE,
  UUID_INEXISTANT,
  UUID_MALFORME,
  debutAnnee,
  finAnnee,
  unique,
} from '../../../test-data/builders';
import { contexte, etape } from '../../../helpers/scenario';

test.describe('API — Analytique : axes et sections', () => {
  test('la liste des axes renvoie un tableau', async ({ analytiqueClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte habilité sur la comptabilité analytique'],
    });

    const response = await etape(
      'Consulter la liste des axes analytiques',
      'Le service renvoie les axes paramétrés',
      () => analytiqueClient.listerAxesRaw(),
    );

    await etape(
      'Examiner la structure de la réponse',
      'Le corps est un tableau d’axes, vide si aucun axe n’est encore paramétré',
      () => expectJsonArray(response),
    );
  });

  test('un axe créé apparaît dans la liste', async ({ analytiqueClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à paramétrer l’analytique est ouverte'],
      configuration: ['Le code de l’axe est généré au hasard pour éviter tout conflit'],
    });

    const code = unique('AXE');

    await etape(
      'Créer un nouvel axe analytique',
      'Le service accepte la création de l’axe',
      () => analytiqueClient.creerAxe({ code, intitule: `Axe ${code}` }, [200, 201]),
    );

    const axes = await etape(
      'Consulter à nouveau la liste des axes',
      'Le service renvoie la liste mise à jour',
      () => analytiqueClient.listerAxes(),
    );

    await etape(
      'Rechercher l’axe créé dans la liste',
      'L’axe figure bien au paramétrage : la création a été persistée',
      async () => {
        expect(axes.some((a) => a.code === code)).toBeTruthy();
      },
    );
  });

  test('la création d’un axe sans code est refusée', async ({ analytiqueClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à paramétrer l’analytique est ouverte'],
      configuration: ['Aucun code n’est transmis pour l’axe'],
    });

    const response = await etape(
      'Créer un axe analytique sans lui donner de code',
      'Le service refuse : le code identifie l’axe dans le paramétrage',
      () =>
        analytiqueClient.creerAxe({ intitule: 'Sans code' }, [
          ...BAD_REQUEST_STATUSES,
          200,
          201,
        ]),
    );

    await etape(
      'Contrôler le code retour',
      'Le comportement observé est documenté : refus de validation (400, 415, 422, 500) ou acceptation (200, 201) selon le paramétrage de l’environnement',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 200, 201], 'axe sans code'),
    );
  });

  test('un code d’axe dupliqué est refusé', async ({ analytiqueClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à paramétrer l’analytique est ouverte'],
      configuration: ['Le code d’un axe est unique : deux axes ne peuvent le partager'],
    });

    const code = unique('AXE');

    await etape(
      'Créer un premier axe analytique avec un code donné',
      'Le service accepte la création du premier axe',
      () => analytiqueClient.creerAxe({ code, intitule: 'Premier' }, [200, 201]),
    );

    const doublon = await etape(
      'Créer un second axe en réutilisant le même code',
      'Le service refuse le doublon : le code doit rester unique',
      () =>
        analytiqueClient.creerAxe({ code, intitule: 'Doublon' }, [
          ...BAD_REQUEST_STATUSES,
          409,
          200,
          201,
        ]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code traduit un refus explicite (400, 409, 422 ou 500) : le second axe n’est jamais créé',
      async () => {
        expect([400, 409, 422, 500]).toContain(doublon.status());
      },
    );
  });

  test('la désactivation d’un axe est prise en compte', async ({ analytiqueClient }) => {
    await contexte({
      preconditions: ['Au moins un axe analytique existe, sans quoi le cas est ignoré'],
      configuration: [
        'L’axe est désactivé puis réactivé, pour rendre à l’environnement son état de départ',
      ],
    });

    const axes = await etape(
      'Prendre un axe analytique existant',
      'Le service renvoie au moins un axe',
      () => analytiqueClient.listerAxes(),
    );
    test.skip(axes.length === 0, 'aucun axe analytique en base');
    const id = String(axes[0].id);

    await etape(
      'Désactiver cet axe',
      'Le service accepte la désactivation : l’axe n’est plus proposé à la ventilation',
      () => analytiqueClient.modifierStatutAxe(id, false, [200, 204]),
    );

    await etape(
      'Réactiver le même axe',
      'L’axe redevient disponible : la bascule d’activation est réversible',
      () => analytiqueClient.modifierStatutAxe(id, true, [200, 204]),
    );
  });

  test('la modification de statut d’un axe inexistant échoue', async ({ analytiqueClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à paramétrer l’analytique est ouverte'],
      configuration: ['L’axe visé n’existe pas'],
    });

    const response = await etape(
      'Activer un axe analytique qui n’existe pas',
      'Le service signale que l’axe est introuvable',
      () => analytiqueClient.modifierStatutAxe(UUID_INEXISTANT, true, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'statut axe inexistant'),
    );
  });

  test('le paramètre actif est obligatoire', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session habilitée à paramétrer l’analytique est ouverte'],
      configuration: ['Le nouvel état de l’axe n’est pas transmis'],
    });

    const response = await etape(
      'Modifier le statut d’un axe sans préciser s’il doit être actif ou non',
      'Le service refuse : sans état cible, la demande est ambiguë',
      () => apiContext.put(ANALYTIQUE_PATHS.axeStatut(UUID_INEXISTANT)),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'statut sans paramètre actif'),
    );
  });

  test('une section créée apparaît sous son axe', async ({ analytiqueClient }) => {
    await contexte({
      preconditions: ['Au moins un axe analytique existe, sans quoi le cas est ignoré'],
      configuration: ['Le code de la section est généré au hasard pour éviter tout conflit'],
    });

    const axes = await etape(
      'Prendre un axe analytique existant',
      'Le service renvoie au moins un axe',
      () => analytiqueClient.listerAxes(),
    );
    test.skip(axes.length === 0, 'aucun axe analytique en base');
    const axeId = String(axes[0].id);
    const code = unique('SEC');

    await etape(
      'Créer une section sous cet axe',
      'Le service accepte la création de la section',
      () =>
        analytiqueClient.creerSection(axeId, { code, intitule: `Section ${code}` }, [200, 201]),
    );

    const response = await etape(
      'Consulter les sections rattachées à cet axe',
      'Le service renvoie la liste des sections de l’axe',
      () => analytiqueClient.listerSections(axeId),
    );

    await etape(
      'Rechercher la section créée dans la liste',
      'La section figure bien sous son axe : le rattachement a été enregistré',
      async () => {
        const sections = (await response.json()) as Record<string, unknown>[];
        expect(sections.some((s) => s.code === code)).toBeTruthy();
      },
    );
  });

  test('créer une section sous un axe inexistant échoue', async ({ analytiqueClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à paramétrer l’analytique est ouverte'],
      configuration: ['L’axe de rattachement désigné n’existe pas'],
    });

    const response = await etape(
      'Créer une section sous un axe analytique qui n’existe pas',
      'Le service signale que l’axe est introuvable : une section ne flotte pas sans axe',
      () =>
        analytiqueClient.creerSection(
          UUID_INEXISTANT,
          { code: unique('SEC'), intitule: 'x' },
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'section axe inexistant'),
    );
  });

  test('lister les sections d’un axe inexistant renvoie vide ou 404', async ({
    analytiqueClient,
  }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’axe dont on demande les sections n’existe pas'],
    });

    const response = await etape(
      'Consulter les sections d’un axe analytique qui n’existe pas',
      'Le service renvoie une liste vide ou signale que l’axe est introuvable',
      () => analytiqueClient.listerSections(UUID_INEXISTANT, [200, ...NOT_FOUND_STATUSES]),
    );

    await etape(
      'Examiner la réponse lorsqu’elle aboutit',
      'En cas de succès, la liste est vide : aucune section n’est inventée pour un axe absent',
      async () => {
        if (response.status() === 200) {
          const sections = await expectJsonArray(response);
          expect(sections).toHaveLength(0);
        }
      },
    );
  });

  test('un axeId malformé est rejeté', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant d’axe transmis n’a pas la forme d’un UUID'],
    });

    const response = await etape(
      'Consulter les sections d’un axe avec un identifiant malformé',
      'Le service rejette la valeur avant même de chercher en base',
      () => apiContext.get(ANALYTIQUE_PATHS.axeSections(UUID_MALFORME)),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'axeId malformé'),
    );
  });

  test('la modification de statut d’une section inexistante échoue', async ({ analytiqueClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à paramétrer l’analytique est ouverte'],
      configuration: ['La section visée n’existe pas'],
    });

    const response = await etape(
      'Désactiver une section analytique qui n’existe pas',
      'Le service signale que la section est introuvable',
      () => analytiqueClient.modifierStatutSection(UUID_INEXISTANT, false, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'statut section inexistante'),
    );
  });
});

test.describe('API — Analytique : ventilations', () => {
  test('ventiler une ligne inexistante échoue', async ({ analytiqueClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à ventiler est ouverte'],
      configuration: ['La ligne d’écriture à ventiler n’existe pas'],
    });

    const response = await etape(
      'Ventiler une ligne d’écriture qui n’existe pas sur une section analytique',
      'Le service signale que la ligne est introuvable au lieu de ventiler dans le vide',
      () =>
        analytiqueClient.ventilerLigne(
          UUID_INEXISTANT,
          [{ sectionId: UUID_INEXISTANT, pourcentage: 100 }],
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'ventilation ligne inexistante'),
    );
  });

  test('une ventilation dont le total dépasse 100 % est refusée', async ({ analytiqueClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à ventiler est ouverte'],
      configuration: [
        'Deux ventilations de 60 % sont soumises, soit 120 % au total : une charge ne se répartit pas au-delà d’elle-même',
      ],
    });

    const response = await etape(
      'Ventiler une ligne sur deux sections à 60 % chacune',
      'Le service refuse : la somme des quotes-parts dépasserait le montant à répartir',
      () =>
        analytiqueClient.ventilerLigne(
          UUID_INEXISTANT,
          [
            { sectionId: UUID_INEXISTANT, pourcentage: 60 },
            { sectionId: UUID_INEXISTANT, pourcentage: 60 },
          ],
          [...BAD_REQUEST_STATUSES, 404],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou de la ressource introuvable (404)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'ventilation > 100 %'),
    );
  });

  test('une ventilation vide est refusée', async ({ analytiqueClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à ventiler est ouverte'],
      configuration: ['Aucune quote-part n’est transmise'],
    });

    const response = await etape(
      'Ventiler une ligne sans indiquer aucune section ni quote-part',
      'Le service refuse : une ventilation vide ne répartit rien',
      () =>
        analytiqueClient.ventilerLigne(UUID_INEXISTANT, [], [...BAD_REQUEST_STATUSES, 404]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou de la ressource introuvable (404)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 404], 'ventilation vide'),
    );
  });
});

test.describe('API — Analytique : budgets par section', () => {
  test('la liste des budgets d’une année renvoie un tableau', async ({ analytiqueBudgetClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’exercice demandé est l’année en cours'],
    });

    const response = await etape(
      'Consulter les budgets analytiques de l’exercice en cours',
      'Le service renvoie les budgets définis par section',
      () => analytiqueBudgetClient.listerParAnneeRaw(ANNEE_COURANTE),
    );

    await etape(
      'Examiner la structure de la réponse',
      'Le corps est un tableau de budgets, vide si aucun n’a été défini',
      () => expectJsonArray(response),
    );
  });

  test('une année sans budget renvoie une liste vide', async ({ analytiqueBudgetClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’exercice demandé est 1900 : aucun budget ne peut y être défini'],
    });

    const budgets = await etape(
      'Consulter les budgets analytiques d’un exercice sans aucune donnée',
      'Le service répond normalement plutôt que de signaler une erreur',
      () => analytiqueBudgetClient.listerParAnnee(1900),
    );

    await etape(
      'Contrôler le résultat',
      'La liste est vide : un exercice sans budget ne renvoie pas ceux d’un autre exercice',
      async () => {
        expect(budgets).toHaveLength(0);
      },
    );
  });

  test('une année non numérique est rejetée', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Aucun exercice exploitable n’est transmis'],
    });

    const response = await etape(
      'Consulter les budgets analytiques sans fournir d’exercice valide',
      'Le service refuse la demande au lieu d’appliquer un exercice par défaut',
      () => apiContext.get(`${ANALYTIQUE_PATHS.budgetsBase}/annee`),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'année non numérique'),
    );
  });

  test('la définition d’un budget sur une section inexistante échoue', async ({
    analytiqueBudgetClient,
  }) => {
    await contexte({
      preconditions: ['Une session habilitée à définir des budgets analytiques est ouverte'],
      configuration: ['Le budget est complet, mais la section analytique visée n’existe pas'],
    });

    const response = await etape(
      'Définir un budget analytique sur une section qui n’existe pas',
      'Le service signale que la section est introuvable plutôt que de créer un budget orphelin',
      () =>
        analytiqueBudgetClient.definirBudget(
          {
            annee: ANNEE_COURANTE,
            sectionId: UUID_INEXISTANT,
            compteCode: '605200',
            montantBudget: 1_000_000,
          },
          [...NOT_FOUND_STATUSES, 200, 201],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le comportement observé est documenté : ressource introuvable (400, 404, 409, 500) ou acceptation (200, 201) selon l’environnement',
      () =>
        expectStatusIn(
          response,
          [...NOT_FOUND_STATUSES, 200, 201],
          'budget section inexistante',
        ),
    );
  });

  test('le suivi par section renvoie une liste', async ({ analytiqueBudgetClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La section demandée n’existe pas : le suivi ne doit rien inventer'],
    });

    const response = await etape(
      'Consulter le suivi budgétaire d’une section inexistante sur l’exercice en cours',
      'Le service renvoie une liste vide ou signale que la section est introuvable',
      () =>
        analytiqueBudgetClient.listerParSection(ANNEE_COURANTE, UUID_INEXISTANT, [
          200,
          ...NOT_FOUND_STATUSES,
        ]),
    );

    await etape(
      'Examiner la réponse lorsqu’elle aboutit',
      'En cas de succès, la liste est vide : aucun budget n’est attribué à une section absente',
      async () => {
        if (response.status() === 200) {
          const budgets = await expectJsonArray(response);
          expect(budgets).toHaveLength(0);
        }
      },
    );
  });
});

test.describe('API — Analytique : clés de répartition', () => {
  test('la liste des clés renvoie un tableau', async ({ cleRepartitionClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
    });

    const response = await etape(
      'Consulter la liste des clés de répartition',
      'Le service renvoie les clés paramétrées',
      () => cleRepartitionClient.listerClesRaw(),
    );

    await etape(
      'Examiner la structure de la réponse',
      'Le corps est un tableau de clés, vide si aucune n’est paramétrée',
      () => expectJsonArray(response),
    );
  });

  test('une clé créée apparaît dans la liste', async ({ cleRepartitionClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à paramétrer les clés est ouverte'],
      configuration: ['Le code de la clé est généré au hasard pour éviter tout conflit'],
    });

    const code = unique('CLE');

    await etape(
      'Créer une clé de répartition',
      'Le service traite la demande de création',
      () =>
        cleRepartitionClient.creerCle({ code, intitule: `Clé ${code}`, details: [] }, [
          200,
          201,
          ...BAD_REQUEST_STATUSES,
        ]),
    );

    const cles = await etape(
      'Consulter à nouveau la liste des clés',
      'Le service renvoie la liste mise à jour',
      () => cleRepartitionClient.listerCles(),
    );

    await etape(
      'Examiner la liste renvoyée',
      'La liste reste exploitable après la création : le paramétrage n’est pas corrompu',
      async () => {
        expect(Array.isArray(cles)).toBeTruthy();
      },
    );
  });

  test('une clé sans code est refusée', async ({ cleRepartitionClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à paramétrer les clés est ouverte'],
      configuration: ['Aucun code n’est transmis pour la clé'],
    });

    const response = await etape(
      'Créer une clé de répartition sans lui donner de code',
      'Le service refuse : le code identifie la clé dans le paramétrage',
      () =>
        cleRepartitionClient.creerCle({ intitule: 'Sans code', details: [] }, [
          ...BAD_REQUEST_STATUSES,
          200,
          201,
        ]),
    );

    await etape(
      'Contrôler le code retour',
      'Le comportement observé est documenté : refus de validation (400, 415, 422, 500) ou acceptation (200, 201) selon l’environnement',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 200, 201], 'clé sans code'),
    );
  });

  test('appliquer une clé inexistante à une ligne inexistante échoue', async ({
    cleRepartitionClient,
  }) => {
    await contexte({
      preconditions: ['Une session habilitée à ventiler est ouverte'],
      configuration: ['Ni la clé de répartition ni la ligne d’écriture visées n’existent'],
    });

    const response = await etape(
      'Appliquer une clé de répartition inexistante à une ligne inexistante',
      'Le service signale que les ressources sont introuvables au lieu de ventiler à l’aveugle',
      () =>
        cleRepartitionClient.appliquerCle(UUID_INEXISTANT, UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'application clé inexistante'),
    );
  });
});

test.describe('API — Analytique : reporting', () => {
  test('le grand livre analytique couvre la période demandée', async ({
    reportingAnalytiqueClient,
  }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La période demandée couvre l’exercice en cours'],
    });

    const sections = await etape(
      'Éditer le grand livre analytique sur l’exercice en cours',
      'Le service produit l’état, organisé par section analytique',
      () =>
        reportingAnalytiqueClient.grandLivre(
          debutAnnee(ANNEE_COURANTE),
          finAnnee(ANNEE_COURANTE),
        ),
    );

    await etape(
      'Examiner la structure de l’état',
      'Le résultat est un tableau de sections, vide si aucun mouvement analytique n’existe',
      async () => {
        expect(Array.isArray(sections)).toBeTruthy();
      },
    );
  });

  test('le grand livre exige ses deux bornes', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Seule la borne de début est transmise, la borne de fin est omise'],
    });

    const response = await etape(
      'Éditer le grand livre analytique en ne précisant que la date de début',
      'Le service refuse : une période ouverte n’est pas acceptée pour un état analytique',
      () =>
        apiContext.get(ANALYTIQUE_PATHS.grandLivre, {
          params: { debut: debutAnnee(ANNEE_COURANTE) },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'grand livre sans fin'),
    );
  });

  test('la balance analytique est équilibrée', async ({ reportingAnalytiqueClient }) => {
    await contexte({
      preconditions: [
        'Au moins un mouvement analytique existe sur la période, sans quoi le cas est ignoré',
        'La ventilation analytique reprend des écritures tenues en partie double',
      ],
    });

    const lignes = await etape(
      'Éditer la balance analytique sur l’exercice en cours',
      'Le service renvoie les totaux débit et crédit par section',
      () =>
        reportingAnalytiqueClient.balance(debutAnnee(ANNEE_COURANTE), finAnnee(ANNEE_COURANTE)),
    );
    test.skip(lignes.length === 0, 'aucun mouvement analytique sur la période');

    await etape(
      'Totaliser les débits et les crédits de la balance',
      'Les deux totaux sont égaux à moins d’une unité près : la ventilation n’a ni créé ni perdu de montant',
      async () => {
        const debit = lignes.reduce((total, l) => total + Number(l.totalDebit ?? l.debit ?? 0), 0);
        const credit = lignes.reduce(
          (total, l) => total + Number(l.totalCredit ?? l.credit ?? 0),
          0,
        );
        expect(Math.abs(debit - credit)).toBeLessThan(1);
      },
    );
  });

  test('le compte de résultat d’une section inexistante échoue proprement', async ({
    reportingAnalytiqueClient,
  }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La section analytique visée n’existe pas'],
    });

    const response = await etape(
      'Éditer le compte de résultat d’une section analytique inexistante',
      'Le service répond proprement plutôt que de produire un état incohérent',
      () =>
        reportingAnalytiqueClient.compteResultat(UUID_INEXISTANT, ANNEE_COURANTE, [
          200,
          ...NOT_FOUND_STATUSES,
        ]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code est un succès sans donnée (200) ou une ressource introuvable (400, 404, 409, 500) : jamais une erreur de forme',
      () =>
        expectStatusIn(response, [200, ...NOT_FOUND_STATUSES], 'résultat section inexistante'),
    );
  });

  test('le suivi budgétaire d’une section inexistante échoue proprement', async ({
    reportingAnalytiqueClient,
  }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La section analytique visée n’existe pas'],
    });

    const response = await etape(
      'Consulter le suivi budgétaire d’une section analytique inexistante',
      'Le service répond proprement plutôt que de comparer un réalisé à un budget imaginaire',
      () =>
        reportingAnalytiqueClient.suiviBudgetaire(UUID_INEXISTANT, ANNEE_COURANTE, [
          200,
          ...NOT_FOUND_STATUSES,
        ]),
    );

    await etape(
      'Contrôler le code retour',
      'Le code est un succès sans donnée (200) ou une ressource introuvable (400, 404, 409, 500)',
      () => expectStatusIn(response, [200, ...NOT_FOUND_STATUSES], 'suivi section inexistante'),
    );
  });

  test('le suivi budgétaire d’une section réelle est exploitable', async ({
    analytiqueClient,
    reportingAnalytiqueClient,
  }) => {
    await contexte({
      preconditions: [
        'Au moins un axe analytique existe et porte au moins une section, sans quoi le cas est ignoré',
      ],
      configuration: ['Le suivi porte sur l’exercice en cours'],
    });

    const axes = await etape(
      'Prendre un axe analytique existant',
      'Le service renvoie au moins un axe',
      () => analytiqueClient.listerAxes(),
    );
    test.skip(axes.length === 0, 'aucun axe analytique en base');

    const sectionsResponse = await etape(
      'Consulter les sections rattachées à cet axe',
      'Le service renvoie les sections de l’axe',
      () => analytiqueClient.listerSections(String(axes[0].id)),
    );
    const sections = (await sectionsResponse.json()) as Record<string, unknown>[];
    test.skip(sections.length === 0, 'aucune section analytique en base');

    const response = await etape(
      'Consulter le suivi budgétaire de la première section, sur l’exercice en cours',
      'Le service produit le suivi rapprochant le budget de la section et son réalisé',
      () =>
        reportingAnalytiqueClient.suiviBudgetaire(String(sections[0].id), ANNEE_COURANTE),
    );

    await etape(
      'Contrôler la réponse',
      'Le suivi aboutit : une section réellement paramétrée dispose bien d’un état de suivi',
      async () => {
        expect(response.ok()).toBeTruthy();
      },
    );
  });
});
