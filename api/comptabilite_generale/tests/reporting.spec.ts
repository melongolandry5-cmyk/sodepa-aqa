import { test, expect } from '../comptabilite-generale-fixtures';
import { expectJsonArray, expectStatusIn } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES } from '../../../helpers/http';
import { ANNEE_COURANTE, debutAnnee, finAnnee, today } from '../../../test-data/builders';

const DEBUT = debutAnnee(ANNEE_COURANTE);
const FIN = finAnnee(ANNEE_COURANTE);

test.describe('API — Reporting comptable : états périodiques', () => {
  test('le livre-journal renvoie un tableau', async ({ reportingClient }) => {
    const response = await reportingClient.livreJournalRaw({ debut: DEBUT, fin: FIN });

    await expectJsonArray(response);
  });

  test('le livre-journal exige ses deux bornes', async ({ apiContext }) => {
    const response = await apiContext.get('/api/comptabilite/reporting/livre-journal', {
      params: { debut: DEBUT },
    });

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'livre-journal sans fin');
  });

  test('les lignes du livre-journal sont dans la période demandée', async ({ reportingClient }) => {
    const lignes = await reportingClient.livreJournal(DEBUT, FIN);
    test.skip(lignes.length === 0, 'aucune écriture sur la période');

    for (const ligne of lignes) {
      const date = (ligne.date ?? ligne.dateComptable) as string | undefined;
      if (!date) continue;
      expect(date >= DEBUT && date <= FIN).toBeTruthy();
    }
  });

  test('le grand livre renvoie un tableau de comptes', async ({ reportingClient }) => {
    const comptes = await reportingClient.grandLivre(DEBUT, FIN);

    expect(Array.isArray(comptes)).toBeTruthy();
  });

  test('la balance est équilibrée', async ({ reportingClient }) => {
    const lignes = await reportingClient.balance(DEBUT, FIN);
    test.skip(lignes.length === 0, 'aucun mouvement sur la période');

    const debit = lignes.reduce((total, l) => total + Number(l.totalDebit ?? l.debit ?? 0), 0);
    const credit = lignes.reduce((total, l) => total + Number(l.totalCredit ?? l.credit ?? 0), 0);
    expect(Math.abs(debit - credit)).toBeLessThan(1);
  });

  test('une fenêtre inversée ne renvoie aucun mouvement', async ({ reportingClient }) => {
    const lignes = await reportingClient.livreJournal(FIN, DEBUT);

    expect(lignes).toHaveLength(0);
  });

  test('une date mal formatée est rejetée', async ({ apiContext }) => {
    const response = await apiContext.get('/api/comptabilite/reporting/balance', {
      params: { debut: '31-12-2025', fin: FIN },
    });

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'balance date mal formatée');
  });
});

test.describe('API — Reporting comptable : états de synthèse OHADA', () => {
  test('le bilan est produit à une date donnée', async ({ reportingClient }) => {
    const bilan = await reportingClient.bilan(today());

    expect(bilan).toBeTruthy();
    expect(Object.keys(bilan).length).toBeGreaterThan(0);
  });

  test('le bilan exige une date', async ({ apiContext }) => {
    const response = await apiContext.get('/api/comptabilite/reporting/bilan');

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'bilan sans date');
  });

  test('le compte de résultat est produit pour un exercice', async ({ reportingClient }) => {
    const resultat = await reportingClient.compteResultat(ANNEE_COURANTE);

    expect(resultat).toBeTruthy();
  });

  test('le compte de résultat exige une année', async ({ apiContext }) => {
    const response = await apiContext.get('/api/comptabilite/reporting/compte-resultat');

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'compte de résultat sans année');
  });

  test('le TFT est produit pour un exercice', async ({ reportingClient }) => {
    const tft = await reportingClient.tft(ANNEE_COURANTE);

    expect(tft).toBeTruthy();
  });

  test('la déclaration de TVA est produite pour un mois', async ({ reportingClient }) => {
    const tva = await reportingClient.tva(ANNEE_COURANTE, 1);

    expect(tva).toBeTruthy();
  });

  test('la déclaration de TVA exige le mois', async ({ apiContext }) => {
    const response = await apiContext.get('/api/comptabilite/reporting/tva', {
      params: { annee: ANNEE_COURANTE },
    });

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'tva sans mois');
  });

  test('un mois hors bornes est refusé ou renvoie une déclaration vide', async ({
    apiContext,
  }) => {
    const response = await apiContext.get('/api/comptabilite/reporting/tva', {
      params: { annee: ANNEE_COURANTE, mois: 13 },
    });

    await expectStatusIn(response, [200, ...BAD_REQUEST_STATUSES], 'tva mois 13');
  });

  test('le FEC est téléchargeable pour un exercice', async ({ reportingClient }) => {
    const fec = await reportingClient.fec(ANNEE_COURANTE);

    expect(typeof fec).toBe('string');
  });

  test('le FEC exige une année', async ({ apiContext }) => {
    const response = await apiContext.get('/api/comptabilite/reporting/fec');

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'fec sans année');
  });

  test('le FEC d’un exercice sans écriture reste exploitable', async ({ reportingClient }) => {
    const fec = await reportingClient.fec(1900);

    expect(typeof fec).toBe('string');
  });
});
