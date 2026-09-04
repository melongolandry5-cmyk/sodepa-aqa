import { test, expect } from '../tresorerie-fixtures';
import { couvertureValide, previsionValide } from '../tresorerie-payload-builder';
import { TRESORERIE_PATHS } from '../tresorerie-api-paths';
import { expectStatusIn } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import {
  ANNEE_COURANTE,
  UUID_INEXISTANT,
  debutAnnee,
  finAnnee,
  isoDate,
  today,
  unique,
} from '../../../test-data/builders';
import { contexte, etape } from '../../../helpers/scenario';

test.describe('API — Trésorerie : prévisions', () => {
  test('la liste des prévisions sur une période renvoie un tableau', async ({ tresorerieClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte habilité sur la trésorerie'],
      configuration: ['La période demandée couvre l’exercice en cours'],
    });

    const previsions = await etape(
      'Consulter les prévisions de trésorerie de l’exercice en cours',
      'Le service renvoie les prévisions enregistrées sur la période',
      () =>
        tresorerieClient.listerPrevisions(debutAnnee(ANNEE_COURANTE), finAnnee(ANNEE_COURANTE)),
    );

    await etape(
      'Examiner la structure du résultat',
      'Le résultat est un tableau de prévisions, vide si aucune n’a été saisie',
      async () => {
        expect(Array.isArray(previsions)).toBeTruthy();
      },
    );
  });

  test('les prévisions renvoyées sont dans la fenêtre demandée', async ({ tresorerieClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La période demandée couvre l’exercice en cours'],
    });

    const debut = debutAnnee(ANNEE_COURANTE);
    const fin = finAnnee(ANNEE_COURANTE);

    const previsions = await etape(
      'Consulter les prévisions de trésorerie sur l’exercice en cours',
      'Le service renvoie les prévisions de la période',
      () => tresorerieClient.listerPrevisions(debut, fin),
    );

    await etape(
      'Contrôler l’échéance de chaque prévision renvoyée',
      'Aucune échéance ne sort de la période demandée : la liste ne déborde pas sur un autre exercice',
      async () => {
        for (const prevision of previsions) {
          const echeance = prevision.dateEcheance as string | undefined;
          if (!echeance) continue;
          expect(echeance >= debut && echeance <= fin).toBeTruthy();
        }
      },
    );
  });

  test('une fenêtre inversée renvoie un résultat vide', async ({ tresorerieClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Les bornes sont transmises à l’envers : la fin précède le début'],
    });

    const previsions = await etape(
      'Consulter les prévisions en inversant les bornes de la période',
      'Le service traite la demande sans erreur mais ne trouve rien dans un intervalle vide',
      () =>
        tresorerieClient.listerPrevisions(finAnnee(ANNEE_COURANTE), debutAnnee(ANNEE_COURANTE)),
    );

    await etape(
      'Contrôler le résultat',
      'Aucune prévision n’est renvoyée : une période inversée ne doit pas tout retourner',
      async () => {
        expect(previsions).toHaveLength(0);
      },
    );
  });

  test('le paramètre debut est obligatoire', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Seule la borne de fin est transmise'],
    });

    const response = await etape(
      'Consulter les prévisions sans préciser la date de début',
      'Le service refuse : une période ouverte n’est pas acceptée',
      () =>
        apiContext.get(TRESORERIE_PATHS.previsions, {
          params: { fin: finAnnee(ANNEE_COURANTE) },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'previsions sans debut'),
    );
  });

  test('une date mal formatée est rejetée', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La date de début est écrite avec des barres obliques au lieu du format attendu'],
    });

    const response = await etape(
      'Consulter les prévisions avec une date de début mal formatée',
      'Le service rejette la date au lieu de l’interpréter au hasard',
      () =>
        apiContext.get(TRESORERIE_PATHS.previsions, {
          params: { debut: '2025/01/01', fin: finAnnee(ANNEE_COURANTE) },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'date mal formatée'),
    );
  });

  test('une prévision créée est retrouvée dans la période', async ({ tresorerieClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à saisir des prévisions est ouverte'],
      configuration: [
        'Le libellé est généré au hasard pour retrouver la prévision sans ambiguïté',
        'La recherche porte sur les douze mois à venir',
      ],
    });

    const libelle = `Prévision ${unique('PRV')}`;

    await etape(
      'Saisir une nouvelle prévision de trésorerie',
      'Le service enregistre la prévision',
      () => tresorerieClient.ajouterPrevision(previsionValide({ libelle })),
    );

    const previsions = await etape(
      'Consulter les prévisions des douze prochains mois',
      'Le service renvoie les prévisions de la période, mise à jour',
      () => tresorerieClient.listerPrevisions(today(), isoDate(365)),
    );

    await etape(
      'Rechercher la prévision saisie dans la liste',
      'La prévision figure bien dans la période : la saisie a été persistée et reste retrouvable',
      async () => {
        expect(previsions.some((p) => p.libelle === libelle)).toBeTruthy();
      },
    );
  });

  test('la création exige un montant strictement positif', async ({ tresorerieClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à saisir des prévisions est ouverte'],
      configuration: ['Le montant de la prévision est nul'],
    });

    const response = await etape(
      'Saisir une prévision de trésorerie d’un montant nul',
      'Le service refuse : une prévision sans montant n’a aucun effet sur la trésorerie',
      () =>
        tresorerieClient.ajouterPrevision(previsionValide({ montant: 0 }), BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'prévision montant nul'),
    );
  });

  test('la création exige un libellé', async ({ tresorerieClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à saisir des prévisions est ouverte'],
      configuration: ['Le libellé de la prévision est vide'],
    });

    const response = await etape(
      'Saisir une prévision de trésorerie sans libellé',
      'Le service refuse : le libellé rend la prévision identifiable dans le plan de trésorerie',
      () =>
        tresorerieClient.ajouterPrevision(
          previsionValide({ libelle: '' }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'prévision sans libellé'),
    );
  });

  test('la création exige une date d’échéance', async ({ tresorerieClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à saisir des prévisions est ouverte'],
      configuration: ['Aucune date d’échéance n’est renseignée'],
    });

    const response = await etape(
      'Saisir une prévision de trésorerie sans date d’échéance',
      'Le service refuse : sans échéance, la prévision ne peut être positionnée dans le temps',
      () =>
        tresorerieClient.ajouterPrevision(
          previsionValide({ dateEcheance: undefined }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'prévision sans échéance'),
    );
  });
});

test.describe('API — Trésorerie : états et simulations', () => {
  test('le cash-flow mensuel couvre la période demandée', async ({ tresorerieClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La période demandée couvre les douze mois de l’exercice en cours'],
    });

    const cashFlow = await etape(
      'Éditer le cash-flow mensuel de l’exercice en cours',
      'Le service produit un flux par mois de la période',
      () => tresorerieClient.cashFlow(debutAnnee(ANNEE_COURANTE), finAnnee(ANNEE_COURANTE)),
    );

    await etape(
      'Contrôler le découpage de l’état',
      'L’état comporte au plus douze points : un exercice ne compte pas plus de douze mois',
      async () => {
        expect(Array.isArray(cashFlow)).toBeTruthy();
        expect(cashFlow.length).toBeLessThanOrEqual(12);
      },
    );
  });

  test('le cash-flow exige les deux bornes', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Seule la borne de début est transmise'],
    });

    const response = await etape(
      'Éditer le cash-flow en ne précisant que la date de début',
      'Le service refuse : une période ouverte n’est pas acceptée',
      () =>
        apiContext.get(TRESORERIE_PATHS.cashFlow, {
          params: { debut: debutAnnee(ANNEE_COURANTE) },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'cash-flow sans fin'),
    );
  });

  test('le BFR est calculé à une date donnée', async ({ tresorerieClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le besoin en fonds de roulement est calculé à la date du jour'],
    });

    const bfr = await etape(
      'Calculer le besoin en fonds de roulement à la date du jour',
      'Le service produit le calcul à partir des postes du bilan',
      () => tresorerieClient.bfr(today()),
    );

    await etape(
      'Examiner le résultat produit',
      'Le calcul est renseigné et comporte au moins une composante : ce n’est pas un résultat vide',
      async () => {
        expect(bfr).toBeTruthy();
        expect(Object.keys(bfr).length).toBeGreaterThan(0);
      },
    );
  });

  test('le BFR exige une date', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Aucune date de calcul n’est transmise'],
    });

    const response = await etape(
      'Calculer le besoin en fonds de roulement sans préciser de date',
      'Le service refuse : le besoin en fonds de roulement s’apprécie à une date donnée',
      () => apiContext.get(TRESORERIE_PATHS.bfr),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'bfr sans date'),
    );
  });

  test('les alertes de découvert renvoient un tableau', async ({ tresorerieClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
    });

    const alertes = await etape(
      'Consulter les alertes de découvert bancaire',
      'Le service signale les positions qui menacent de passer en découvert',
      () => tresorerieClient.alertesDecouvert(),
    );

    await etape(
      'Examiner la structure du résultat',
      'Le résultat est un tableau d’alertes, vide lorsque aucune position n’est menacée',
      async () => {
        expect(Array.isArray(alertes)).toBeTruthy();
      },
    );
  });

  test('la simulation what-if renvoie un résultat', async ({ tresorerieClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: [
        'La simulation combine une croissance de 5 %, une inflation de 3 % et une hausse du prix de revient de 2 %',
      ],
    });

    const resultat = await etape(
      'Simuler l’effet conjoint d’une croissance, d’une inflation et d’une hausse du prix de revient',
      'Le service produit une projection de trésorerie sous ces hypothèses',
      () => tresorerieClient.whatIf(1.05, 1.03, 1.02),
    );

    await etape(
      'Examiner le résultat produit',
      'La projection est renseignée : la simulation aboutit à un scénario exploitable',
      async () => {
        expect(resultat).toBeTruthy();
      },
    );
  });

  test('la simulation what-if exige ses trois paramètres', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Seule l’hypothèse de croissance est transmise'],
    });

    const response = await etape(
      'Lancer la simulation en ne fournissant qu’une seule des trois hypothèses',
      'Le service refuse : une projection partielle serait trompeuse',
      () => apiContext.get(TRESORERIE_PATHS.whatIf, { params: { croissance: 1.05 } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'what-if incomplet'),
    );
  });

  test('un paramètre non numérique de la simulation est rejeté', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’hypothèse de croissance vaut « beaucoup », qui n’est pas un nombre'],
    });

    const response = await etape(
      'Lancer la simulation avec une hypothèse de croissance non numérique',
      'Le service rejette la valeur au lieu de la convertir arbitrairement',
      () =>
        apiContext.get(TRESORERIE_PATHS.whatIf, {
          params: { croissance: 'beaucoup', inflation: 1, prixRevient: 1 },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'what-if non numérique'),
    );
  });
});

test.describe('API — Couverture de change (/api/tresorerie/change)', () => {
  test('la liste des couvertures renvoie un tableau', async ({ changeClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte habilité sur la couverture de change'],
    });

    const couvertures = await etape(
      'Consulter la liste des contrats de couverture de change',
      'Le service renvoie les contrats enregistrés',
      () => changeClient.listerCouvertures(),
    );

    await etape(
      'Examiner la structure du résultat',
      'Le résultat est un tableau de contrats, vide si aucun n’a été souscrit',
      async () => {
        expect(Array.isArray(couvertures)).toBeTruthy();
      },
    );
  });

  test('le filtre par devise ne renvoie que cette devise', async ({ changeClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le filtre porte sur les contrats libellés en euros'],
    });

    const couvertures = await etape(
      'Filtrer les contrats de couverture sur l’euro',
      'Le service ne renvoie que les contrats libellés dans cette devise',
      () => changeClient.listerCouvertures({ devise: 'EUR' }),
    );

    await etape(
      'Contrôler la devise de chaque contrat renvoyé',
      'Aucun contrat dans une autre devise n’apparaît : le filtre est réellement appliqué',
      async () => {
        for (const couverture of couvertures) {
          expect(couverture.devise).toBe('EUR');
        }
      },
    );
  });

  test('une devise inconnue renvoie une liste vide', async ({ changeClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La devise demandée n’existe pas'],
    });

    const couvertures = await etape(
      'Filtrer les contrats de couverture sur une devise qui n’existe pas',
      'Le service renvoie une liste vide plutôt qu’une erreur',
      () => changeClient.listerCouvertures({ devise: 'ZZZ' }),
    );

    await etape(
      'Contrôler le résultat',
      'Aucun contrat n’est renvoyé : le filtre ne se rabat pas sur la liste complète',
      async () => {
        expect(couvertures).toHaveLength(0);
      },
    );
  });

  test('un contrat créé est retrouvé dans la liste', async ({ changeClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à enregistrer des couvertures est ouverte'],
      configuration: ['La référence du contrat est générée au hasard pour le retrouver sans ambiguïté'],
    });

    const reference = unique('CVT');

    await etape(
      'Enregistrer un nouveau contrat de couverture de change',
      'Le service enregistre le contrat',
      () => changeClient.enregistrerCouverture(couvertureValide({ reference })),
    );

    const couvertures = await etape(
      'Consulter à nouveau la liste des contrats',
      'Le service renvoie la liste mise à jour',
      () => changeClient.listerCouvertures(),
    );

    await etape(
      'Rechercher le contrat enregistré dans la liste',
      'Le contrat figure bien dans la liste : l’enregistrement a été persisté',
      async () => {
        expect(couvertures.some((c) => c.reference === reference)).toBeTruthy();
      },
    );
  });

  test('la création exige une référence', async ({ changeClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à enregistrer des couvertures est ouverte'],
      configuration: ['La référence du contrat est vide'],
    });

    const response = await etape(
      'Enregistrer un contrat de couverture sans référence',
      'Le service refuse : la référence identifie le contrat auprès de la banque',
      () =>
        changeClient.enregistrerCouverture(
          couvertureValide({ reference: '' }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'couverture sans référence'),
    );
  });

  test('la création exige un montant positif', async ({ changeClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à enregistrer des couvertures est ouverte'],
      configuration: ['Le montant couvert est nul'],
    });

    const response = await etape(
      'Enregistrer un contrat de couverture portant sur un montant nul',
      'Le service refuse : un contrat sans montant ne couvre aucun risque de change',
      () =>
        changeClient.enregistrerCouverture(
          couvertureValide({ montantDevise: 0 }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'couverture montant nul'),
    );
  });

  test('la création exige un cours garanti positif', async ({ changeClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à enregistrer des couvertures est ouverte'],
      configuration: ['Le cours garanti par le contrat est négatif'],
    });

    const response = await etape(
      'Enregistrer un contrat de couverture avec un cours garanti négatif',
      'Le service refuse : un cours de change ne peut pas être négatif',
      () =>
        changeClient.enregistrerCouverture(
          couvertureValide({ coursGaranti: -1 }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'couverture cours négatif'),
    );
  });

  test('l’évaluation d’un contrat inexistant échoue', async ({ changeClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le cours spot est fourni ; seul le contrat visé n’existe pas'],
    });

    const response = await etape(
      'Évaluer un contrat de couverture qui n’existe pas',
      'Le service signale que le contrat est introuvable au lieu de valoriser dans le vide',
      () => changeClient.evaluer(UUID_INEXISTANT, 655.957, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'évaluation contrat inexistant'),
    );
  });

  test('l’évaluation exige un cours spot', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Aucun cours spot n’est transmis'],
    });

    const response = await etape(
      'Évaluer un contrat de couverture sans fournir le cours du marché',
      'Le service refuse : la valorisation compare le cours garanti au cours du marché',
      () => apiContext.get(TRESORERIE_PATHS.couvertureEvaluer(UUID_INEXISTANT)),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'évaluation sans coursSpot'),
    );
  });

  test('l’évaluation d’un contrat existant produit une valorisation', async ({ changeClient }) => {
    await contexte({
      preconditions: ['Au moins un contrat de couverture existe, sans quoi le cas est ignoré'],
      configuration: ['Le cours spot retenu est celui de l’euro face au franc CFA'],
    });

    const couvertures = await etape(
      'Prendre un contrat de couverture existant',
      'Le service renvoie au moins un contrat',
      () => changeClient.listerCouvertures(),
    );
    test.skip(couvertures.length === 0, 'aucun contrat de couverture en base');

    const response = await etape(
      'Évaluer ce contrat au cours du marché',
      'Le service produit la valorisation du contrat, gain ou perte latente selon le cours',
      () => changeClient.evaluer(String(couvertures[0].id), 655.957),
    );

    await etape(
      'Contrôler la réponse',
      'La valorisation aboutit : un contrat réellement enregistré est évaluable',
      async () => {
        expect(response.ok()).toBeTruthy();
      },
    );
  });
});

test.describe('API — Rapprochement et arbitrage (/api/tresorerie/rapprochement)', () => {
  test('le matching d’un relevé inexistant échoue', async ({ rapprochementBancaireClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le relevé bancaire visé n’existe pas'],
    });

    const response = await etape(
      'Lancer le rapprochement automatique d’un relevé qui n’existe pas',
      'Le service signale que le relevé est introuvable',
      () => rapprochementBancaireClient.matcher(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'matching relevé inexistant'),
    );
  });

  test('le matching exige un releveId', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Aucun relevé n’est désigné'],
    });

    const response = await etape(
      'Lancer le rapprochement automatique sans désigner de relevé',
      'Le service refuse : le rapprochement doit cibler un relevé précis',
      () => apiContext.post(TRESORERIE_PATHS.matching),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'matching sans releveId'),
    );
  });

  test('l’arbitrage renvoie des recommandations', async ({ rapprochementBancaireClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: [
        'L’arbitrage porte sur un excédent d’un million, un horizon de 90 jours et un fonds de sécurité de cinq millions',
      ],
    });

    const recommandations = await etape(
      'Demander des recommandations de placement pour un excédent de trésorerie',
      'Le service propose des arbitrages tenant compte de l’horizon et du fonds de sécurité',
      () =>
        rapprochementBancaireClient.arbitrage(1_000_000, today(), isoDate(90), 5_000_000),
    );

    await etape(
      'Examiner la structure du résultat',
      'Le résultat est un tableau de recommandations, vide si aucun placement n’est pertinent',
      async () => {
        expect(Array.isArray(recommandations)).toBeTruthy();
      },
    );
  });

  test('l’arbitrage exige ses quatre paramètres', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Seul le fonds de sécurité est transmis'],
    });

    const response = await etape(
      'Demander un arbitrage en ne fournissant qu’un seul des quatre paramètres',
      'Le service refuse : une recommandation de placement partielle serait hasardeuse',
      () => apiContext.get(TRESORERIE_PATHS.arbitrage, { params: { fondsSecurite: 1000 } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'arbitrage incomplet'),
    );
  });
});

test.describe('API — Pilotage stratégique (/api/reporting)', () => {
  test('le TFT OHADA est généré pour un exercice', async ({ pilotageClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’exercice demandé est l’année en cours'],
    });

    const tft = await etape(
      'Éditer le tableau des flux de trésorerie de l’exercice en cours',
      'Le service produit le TFT prévu par le référentiel OHADA',
      () => pilotageClient.tft(ANNEE_COURANTE),
    );

    await etape(
      'Examiner le document produit',
      'Le tableau est renseigné et non vide',
      async () => {
        expect(tft).toBeTruthy();
      },
    );
  });

  test('le TFT exige une année', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Aucun exercice n’est transmis'],
    });

    const response = await etape(
      'Éditer le tableau des flux de trésorerie sans préciser d’exercice',
      'Le service refuse : le tableau se rapporte à un exercice précis',
      () => apiContext.get(TRESORERIE_PATHS.tft),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'tft sans année'),
    );
  });

  test('une année non numérique est rejetée', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’exercice transmis est le mot « cette », qui n’est pas un nombre'],
    });

    const response = await etape(
      'Éditer le tableau des flux de trésorerie avec un exercice non numérique',
      'Le service rejette la valeur au lieu de la convertir arbitrairement',
      () => apiContext.get(TRESORERIE_PATHS.tft, { params: { annee: 'cette' } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'tft année non numérique'),
    );
  });

  test('le runway est calculé', async ({ pilotageClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: [
        'Le runway mesure combien de temps la trésorerie disponible couvre les charges courantes',
      ],
    });

    const runway = await etape(
      'Calculer l’autonomie financière de l’entreprise',
      'Le service produit l’horizon au-delà duquel la trésorerie serait épuisée',
      () => pilotageClient.runway(),
    );

    await etape(
      'Examiner le résultat produit',
      'Le calcul est renseigné : le pilotage dispose bien d’un indicateur d’autonomie',
      async () => {
        expect(runway).toBeTruthy();
      },
    );
  });
});
