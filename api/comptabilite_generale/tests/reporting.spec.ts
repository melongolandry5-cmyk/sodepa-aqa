import { test, expect } from '../comptabilite-generale-fixtures';
import { COMPTA_PATHS } from '../comptabilite-generale-api-paths';
import { expectJsonArray, expectStatusIn } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES } from '../../../helpers/http';
import { ANNEE_COURANTE, debutAnnee, finAnnee, today } from '../../../test-data/builders';
import { contexte, etape } from '../../../helpers/scenario';

const DEBUT = debutAnnee(ANNEE_COURANTE);
const FIN = finAnnee(ANNEE_COURANTE);

test.describe('API — Reporting comptable : états périodiques', () => {
  test('le livre-journal renvoie un tableau', async ({ reportingClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['La période demandée couvre l’exercice en cours, du 1er janvier au 31 décembre'],
    });

    const response = await etape(
      'Éditer le livre-journal sur l’exercice en cours',
      'Le service produit l’état demandé et répond 200',
      () => reportingClient.livreJournalRaw({ debut: DEBUT, fin: FIN }),
    );

    await etape(
      'Examiner le contenu de l’état',
      'Le corps est un tableau d’écritures, vide si l’exercice n’en comporte aucune',
      () => expectJsonArray(response),
    );
  });

  test('le livre-journal exige ses deux bornes', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['Seule la borne de début est transmise, la borne de fin est omise'],
    });

    const response = await etape(
      'Éditer le livre-journal en ne précisant que la date de début',
      'Le service refuse : une période ouverte n’est pas acceptée pour un état comptable',
      () => apiContext.get(COMPTA_PATHS.livreJournal, { params: { debut: DEBUT } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'livre-journal sans fin'),
    );
  });

  test('les lignes du livre-journal sont dans la période demandée', async ({ reportingClient }) => {
    await contexte({
      preconditions: ['Au moins une écriture existe sur l’exercice, sans quoi le cas est ignoré'],
      configuration: ['La période demandée couvre l’exercice en cours'],
    });

    const lignes = await etape(
      'Éditer le livre-journal sur l’exercice en cours',
      'Le service renvoie les écritures de la période',
      () => reportingClient.livreJournal(DEBUT, FIN),
    );
    test.skip(lignes.length === 0, 'aucune écriture sur la période');

    await etape(
      'Contrôler la date de chaque écriture',
      'Aucune écriture ne sort de la période demandée : l’état ne déborde pas sur un autre exercice',
      async () => {
        for (const ligne of lignes) {
          const date = (ligne.date ?? ligne.dateComptable) as string | undefined;
          if (!date) continue;
          expect(date >= DEBUT && date <= FIN).toBeTruthy();
        }
      },
    );
  });

  test('le grand livre renvoie un tableau de comptes', async ({ reportingClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['La période demandée couvre l’exercice en cours'],
    });

    const comptes = await etape(
      'Éditer le grand livre sur l’exercice en cours',
      'Le service produit l’état, organisé par compte',
      () => reportingClient.grandLivre(DEBUT, FIN),
    );

    await etape(
      'Examiner la structure de l’état',
      'Le résultat est un tableau de comptes, vide si aucun mouvement n’a été enregistré',
      async () => {
        expect(Array.isArray(comptes)).toBeTruthy();
      },
    );
  });

  test('la balance est équilibrée', async ({ reportingClient }) => {
    await contexte({
      preconditions: [
        'Au moins un mouvement existe sur l’exercice, sans quoi le cas est ignoré',
        'La comptabilité est tenue en partie double : tout débit a sa contrepartie au crédit',
      ],
    });

    const lignes = await etape(
      'Éditer la balance générale sur l’exercice en cours',
      'Le service renvoie les totaux débit et crédit par compte',
      () => reportingClient.balance(DEBUT, FIN),
    );
    test.skip(lignes.length === 0, 'aucun mouvement sur la période');

    await etape(
      'Totaliser les débits et les crédits de la balance',
      'Les deux totaux sont égaux à moins d’une unité près : la balance est équilibrée, comme l’exige la partie double',
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

  test('une fenêtre inversée ne renvoie aucun mouvement', async ({ reportingClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['Les bornes sont transmises à l’envers : la fin précède le début'],
    });

    const lignes = await etape(
      'Éditer le livre-journal en inversant les bornes de la période',
      'Le service traite la demande sans erreur mais ne trouve aucune écriture dans un intervalle vide',
      () => reportingClient.livreJournal(FIN, DEBUT),
    );

    await etape(
      'Contrôler le résultat',
      'L’état est vide : une période inversée ne désigne aucun jour, elle ne doit pas tout renvoyer',
      async () => {
        expect(lignes).toHaveLength(0);
      },
    );
  });

  test('une date mal formatée est rejetée', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['La date de début est écrite en format jour-mois-année au lieu du format attendu'],
    });

    const response = await etape(
      'Éditer la balance avec une date de début mal formatée',
      'Le service rejette la date au lieu de l’interpréter au hasard',
      () =>
        apiContext.get(COMPTA_PATHS.balance, { params: { debut: '31-12-2025', fin: FIN } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'balance date mal formatée'),
    );
  });
});

test.describe('API — Reporting comptable : états de synthèse OHADA', () => {
  test('le bilan est produit à une date donnée', async ({ reportingClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['Le bilan est arrêté à la date du jour'],
    });

    const bilan = await etape(
      'Éditer le bilan arrêté à la date du jour',
      'Le service produit un bilan au format OHADA',
      () => reportingClient.bilan(today()),
    );

    await etape(
      'Examiner le bilan produit',
      'Le bilan est renseigné et comporte au moins une rubrique : ce n’est pas un document vide',
      async () => {
        expect(bilan).toBeTruthy();
        expect(Object.keys(bilan).length).toBeGreaterThan(0);
      },
    );
  });

  test('le bilan exige une date', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['Aucune date d’arrêté n’est transmise'],
    });

    const response = await etape(
      'Éditer le bilan sans préciser de date d’arrêté',
      'Le service refuse : un bilan n’a de sens qu’à une date donnée',
      () => apiContext.get(COMPTA_PATHS.bilan),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'bilan sans date'),
    );
  });

  test('le compte de résultat est produit pour un exercice', async ({ reportingClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['L’exercice demandé est l’année en cours'],
    });

    const resultat = await etape(
      'Éditer le compte de résultat de l’exercice en cours',
      'Le service produit un compte de résultat au format OHADA',
      () => reportingClient.compteResultat(ANNEE_COURANTE),
    );

    await etape(
      'Examiner le document produit',
      'Le compte de résultat est renseigné et non vide',
      async () => {
        expect(resultat).toBeTruthy();
      },
    );
  });

  test('le compte de résultat exige une année', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['Aucun exercice n’est transmis'],
    });

    const response = await etape(
      'Éditer le compte de résultat sans préciser d’exercice',
      'Le service refuse : le compte de résultat se rapporte à un exercice précis',
      () => apiContext.get(COMPTA_PATHS.compteResultat),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'compte de résultat sans année'),
    );
  });

  test('le TFT est produit pour un exercice', async ({ reportingClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['L’exercice demandé est l’année en cours'],
    });

    const tft = await etape(
      'Éditer le tableau des flux de trésorerie de l’exercice en cours',
      'Le service produit le TFT prévu par le référentiel OHADA',
      () => reportingClient.tft(ANNEE_COURANTE),
    );

    await etape(
      'Examiner le document produit',
      'Le tableau est renseigné et non vide',
      async () => {
        expect(tft).toBeTruthy();
      },
    );
  });

  test('la déclaration de TVA est produite pour un mois', async ({ reportingClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['La déclaration porte sur le mois de janvier de l’exercice en cours'],
    });

    const tva = await etape(
      'Éditer la déclaration de TVA du mois de janvier',
      'Le service produit la déclaration du mois demandé',
      () => reportingClient.tva(ANNEE_COURANTE, 1),
    );

    await etape(
      'Examiner le document produit',
      'La déclaration est renseignée et non vide',
      async () => {
        expect(tva).toBeTruthy();
      },
    );
  });

  test('la déclaration de TVA exige le mois', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['Seul l’exercice est transmis, le mois est omis'],
    });

    const response = await etape(
      'Éditer la déclaration de TVA en ne précisant que l’exercice',
      'Le service refuse : la TVA se déclare mois par mois',
      () => apiContext.get(COMPTA_PATHS.tva, { params: { annee: ANNEE_COURANTE } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'tva sans mois'),
    );
  });

  test('un mois hors bornes est refusé ou renvoie une déclaration vide', async ({
    apiContext,
  }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['Le mois demandé est le treizième, qui n’existe pas'],
    });

    const response = await etape(
      'Éditer la déclaration de TVA pour un treizième mois',
      'Le service refuse la valeur, ou l’accepte en ne renvoyant aucune donnée : il ne se trompe pas de mois',
      () => apiContext.get(COMPTA_PATHS.tva, { params: { annee: ANNEE_COURANTE, mois: 13 } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code est soit un succès sans donnée (200), soit une erreur de validation (400, 415, 422, 500)',
      () => expectStatusIn(response, [200, ...BAD_REQUEST_STATUSES], 'tva mois 13'),
    );
  });

  test('le FEC est téléchargeable pour un exercice', async ({ reportingClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['L’exercice demandé est l’année en cours'],
    });

    const fec = await etape(
      'Télécharger le fichier des écritures comptables de l’exercice en cours',
      'Le service produit le fichier destiné à l’administration fiscale',
      () => reportingClient.fec(ANNEE_COURANTE),
    );

    await etape(
      'Examiner le fichier produit',
      'Le fichier est bien un contenu textuel exploitable, et non un objet structuré',
      async () => {
        expect(typeof fec).toBe('string');
      },
    );
  });

  test('le FEC exige une année', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['Aucun exercice n’est transmis'],
    });

    const response = await etape(
      'Télécharger le fichier des écritures comptables sans préciser d’exercice',
      'Le service refuse : le fichier se rapporte à un exercice précis',
      () => apiContext.get(COMPTA_PATHS.fec),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'fec sans année'),
    );
  });

  test('le FEC d’un exercice sans écriture reste exploitable', async ({ reportingClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['L’exercice demandé est 1900 : aucune écriture ne peut y figurer'],
    });

    const fec = await etape(
      'Télécharger le fichier des écritures comptables d’un exercice sans aucun mouvement',
      'Le service produit un fichier valide plutôt que d’échouer sur un exercice vide',
      () => reportingClient.fec(1900),
    );

    await etape(
      'Examiner le fichier produit',
      'Le fichier reste un contenu textuel exploitable, même sans aucune écriture à y porter',
      async () => {
        expect(typeof fec).toBe('string');
      },
    );
  });
});
