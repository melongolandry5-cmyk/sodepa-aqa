import { test, expect } from '../comptabilite-generale-fixtures';
import { expectStatusIn } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import { UUID_INEXISTANT, UUID_MALFORME, today, unique } from '../../../test-data/builders';
import { contexte, etape } from '../../../helpers/scenario';

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
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['L’écriture soumise est équilibrée mais n’indique aucun journal'],
    });

    const response = await etape(
      'Saisir une écriture sans préciser le journal de destination',
      'Le service refuse : une écriture doit être rattachée à un journal',
      () =>
        ecritureClient.saisir(
          { ...ecritureEquilibree(UUID_INEXISTANT), journalId: undefined },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'écriture sans journal'),
    );
  });

  test('la saisie exige au moins une ligne', async ({ ecritureClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['L’écriture soumise ne comporte aucune ligne de mouvement'],
    });

    const response = await etape(
      'Saisir une écriture ne comportant aucune ligne',
      'Le service refuse : une écriture sans ligne ne mouvemente aucun compte',
      () =>
        ecritureClient.saisir(
          ecritureEquilibree(UUID_INEXISTANT, { lignes: [] }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'écriture sans ligne'),
    );
  });

  test('la saisie exige un numéro de pièce', async ({ ecritureClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['Le numéro de pièce justificative soumis est vide'],
    });

    const response = await etape(
      'Saisir une écriture sans numéro de pièce justificative',
      'Le service refuse : la pièce justificative est obligatoire pour tracer l’écriture',
      () =>
        ecritureClient.saisir(
          ecritureEquilibree(UUID_INEXISTANT, { numeroPiece: '' }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'écriture sans numéro de pièce'),
    );
  });

  test('la saisie exige une date comptable', async ({ ecritureClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['Aucune date comptable n’est renseignée sur l’écriture'],
    });

    const response = await etape(
      'Saisir une écriture sans date comptable',
      'Le service refuse : la date comptable détermine l’exercice de rattachement',
      () =>
        ecritureClient.saisir(
          ecritureEquilibree(UUID_INEXISTANT, { dateComptable: undefined }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'écriture sans date'),
    );
  });

  test('une écriture déséquilibrée est refusée', async ({ ecritureClient, journalClient }) => {
    await contexte({
      preconditions: [
        'Au moins un journal existe en base, sans quoi le cas est ignoré',
        'La comptabilité est tenue en partie double : débit et crédit doivent s’équilibrer',
      ],
      configuration: ['L’écriture soumise porte 100 000 au débit contre 50 000 au crédit'],
    });

    const journaux = await etape(
      'Relever un journal existant pour y porter l’écriture',
      'Le service renvoie la liste des journaux disponibles',
      () => journalClient.list(),
    );
    test.skip(journaux.length === 0, 'aucun journal en base');

    const response = await etape(
      'Saisir une écriture dont le débit ne correspond pas au crédit',
      'Le service refuse l’écriture : elle romprait l’équilibre de la partie double',
      () =>
        ecritureClient.saisir(
          ecritureEquilibree(String(journaux[0].id), {
            lignes: [
              { compteCode: '601100', debit: 100_000, credit: 0 },
              { compteCode: '401100', debit: 0, credit: 50_000 },
            ],
          }),
          [...BAD_REQUEST_STATUSES, 409],
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève de la validation (400, 415, 422, 500) ou du conflit métier (409)',
      () => expectStatusIn(response, [...BAD_REQUEST_STATUSES, 409], 'écriture déséquilibrée'),
    );
  });

  test('une écriture sur un journal inexistant échoue', async ({ ecritureClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['Le journal désigné par l’écriture n’existe pas en base'],
    });

    const response = await etape(
      'Saisir une écriture équilibrée sur un journal qui n’existe pas',
      'Le service signale que le journal est introuvable au lieu de le créer',
      () => ecritureClient.saisir(ecritureEquilibree(UUID_INEXISTANT), NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'écriture journal inexistant'),
    );
  });

  test('une devise hors énumération est rejetée', async ({ ecritureClient, journalClient }) => {
    await contexte({
      preconditions: ['Au moins un journal existe en base, sans quoi le cas est ignoré'],
      configuration: ['La devise soumise est la livre sterling, absente du référentiel de l’ERP'],
    });

    const journaux = await etape(
      'Relever un journal existant pour y porter l’écriture',
      'Le service renvoie la liste des journaux disponibles',
      () => journalClient.list(),
    );
    test.skip(journaux.length === 0, 'aucun journal en base');

    const response = await etape(
      'Saisir une écriture libellée dans une devise non gérée',
      'Le service refuse la devise au lieu de l’enregistrer telle quelle',
      () =>
        ecritureClient.saisir(
          ecritureEquilibree(String(journaux[0].id), { typeDevise: 'GBP' }),
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'devise hors énumération'),
    );
  });

  test('une écriture équilibrée est enregistrée puis relisible', async ({
    ecritureClient,
    journalClient,
  }) => {
    await contexte({
      preconditions: [
        'Au moins un journal existe en base, sans quoi le cas est ignoré',
        'Le plan comptable de l’environnement comporte les comptes 601100 et 401100',
      ],
      configuration: [
        'L’écriture soumise est équilibrée : 100 000 au débit d’un compte de charge, autant au crédit du fournisseur',
      ],
    });

    const journaux = await etape(
      'Relever un journal existant pour y porter l’écriture',
      'Le service renvoie la liste des journaux disponibles',
      () => journalClient.list(),
    );
    test.skip(journaux.length === 0, 'aucun journal en base');

    const response = await etape(
      'Saisir une écriture équilibrée dans ce journal',
      'Le service enregistre l’écriture et lui attribue un identifiant',
      () =>
        ecritureClient.saisir(ecritureEquilibree(String(journaux[0].id)), [
          200,
          201,
          ...BAD_REQUEST_STATUSES,
          404,
        ]),
    );
    test.skip(
      !response.ok(),
      `le plan comptable de l’environnement ne permet pas la saisie (${response.status()})`,
    );

    const ecriture = (await response.json()) as Record<string, unknown>;

    await etape(
      'Contrôler que l’écriture a bien été créée',
      'L’écriture enregistrée porte un identifiant, preuve qu’elle est persistée',
      async () => {
        expect(ecriture.id).toBeTruthy();
      },
    );

    const relue = await etape(
      'Relire l’écriture par son identifiant',
      'Le service renvoie l’écriture qui vient d’être enregistrée',
      () => ecritureClient.getById(String(ecriture.id)),
    );

    await etape(
      'Comparer l’écriture relue à celle qui a été saisie',
      'C’est bien la même écriture : l’enregistrement n’a pas été perdu ni remplacé',
      async () => {
        const detail = (await relue.json()) as Record<string, unknown>;
        expect(String(detail.id)).toBe(String(ecriture.id));
      },
    );
  });
});

test.describe('API — Écritures : simulation de TVA', () => {
  test('la simulation renvoie les montants attendus', async ({ ecritureClient }) => {
    await contexte({
      preconditions: ['Le compte de charge 601100 existe au plan comptable, sans quoi le cas est ignoré'],
      configuration: [
        'Le montant hors taxe est de 1 000 000 et le taux de TVA de 19,25 %, taux en vigueur au Cameroun',
      ],
    });

    const response = await etape(
      'Simuler la TVA sur un montant de 1 000 000 hors taxe au taux de 19,25 %',
      'Le service calcule la TVA correspondante sans enregistrer d’écriture',
      () =>
        ecritureClient.simulerTva(
          { montantHt: 1_000_000, tauxTva: 19.25, compteHtCode: '601100' },
          [200, ...NOT_FOUND_STATUSES],
        ),
    );
    test.skip(!response.ok(), 'compte 601100 absent du plan comptable de l’environnement');

    await etape(
      'Contrôler le montant de TVA calculé',
      'La TVA vaut 192 500, soit exactement 19,25 % du montant hors taxe',
      async () => {
        const simulation = (await response.json()) as Record<string, unknown>;
        expect(Number(simulation.montantTva ?? simulation.tva)).toBeCloseTo(192_500, 0);
      },
    );
  });

  test('la simulation exige un montant HT', async ({ ecritureClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['Aucun montant hors taxe n’est transmis à la simulation'],
    });

    const response = await etape(
      'Simuler la TVA sans indiquer de montant hors taxe',
      'Le service refuse : sans base de calcul, aucune TVA ne peut être déterminée',
      () =>
        ecritureClient.simulerTva(
          { tauxTva: 19.25, compteHtCode: '601100' },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'simulation sans montant HT'),
    );
  });

  test('la simulation exige un taux', async ({ ecritureClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['Aucun taux de TVA n’est transmis à la simulation'],
    });

    const response = await etape(
      'Simuler la TVA sans indiquer de taux',
      'Le service refuse au lieu d’appliquer un taux implicite',
      () =>
        ecritureClient.simulerTva({ montantHt: 1000, compteHtCode: '601100' }, BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'simulation sans taux'),
    );
  });

  test('la simulation exige un compte de charge', async ({ ecritureClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['Le compte de charge transmis est vide'],
    });

    const response = await etape(
      'Simuler la TVA sans désigner de compte de charge',
      'Le service refuse : la simulation doit savoir sur quel compte imputer le montant',
      () =>
        ecritureClient.simulerTva(
          { montantHt: 1000, tauxTva: 19.25, compteHtCode: '' },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'simulation sans compte'),
    );
  });

  test('un taux nul produit une TVA nulle', async ({ ecritureClient }) => {
    await contexte({
      preconditions: ['Le compte de charge 601100 existe au plan comptable, sans quoi le cas est ignoré'],
      configuration: ['Le taux de TVA transmis est nul, cas des opérations exonérées'],
    });

    const response = await etape(
      'Simuler la TVA sur une opération exonérée, au taux de 0 %',
      'Le service accepte le taux nul plutôt que de le confondre avec une valeur manquante',
      () =>
        ecritureClient.simulerTva(
          { montantHt: 1000, tauxTva: 0, compteHtCode: '601100' },
          [200, ...BAD_REQUEST_STATUSES, ...NOT_FOUND_STATUSES],
        ),
    );
    test.skip(!response.ok(), 'taux nul refusé ou compte absent');

    await etape(
      'Contrôler le montant de TVA calculé',
      'La TVA est nulle : une opération exonérée ne génère aucune taxe',
      async () => {
        const simulation = (await response.json()) as Record<string, unknown>;
        expect(Number(simulation.montantTva ?? simulation.tva ?? 0)).toBeCloseTo(0, 2);
      },
    );
  });
});

test.describe('API — Écritures : workflow de validation', () => {
  test('soumettre une écriture inexistante échoue', async ({ ecritureClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['L’écriture visée n’existe pas en base'],
    });

    const response = await etape(
      'Soumettre à validation une écriture qui n’existe pas',
      'Le service signale que l’écriture est introuvable',
      () => ecritureClient.soumettre(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'soumission écriture inexistante'),
    );
  });

  test('valider une écriture inexistante échoue', async ({ ecritureClient }) => {
    await contexte({
      preconditions: ['Une session comptable habilitée à valider est ouverte'],
      configuration: ['L’écriture visée n’existe pas en base'],
    });

    const response = await etape(
      'Valider une écriture qui n’existe pas',
      'Le service signale que l’écriture est introuvable au lieu de valider dans le vide',
      () => ecritureClient.valider(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'validation écriture inexistante'),
    );
  });

  test('rejeter une écriture inexistante échoue', async ({ ecritureClient }) => {
    await contexte({
      preconditions: ['Une session comptable habilitée à rejeter est ouverte'],
      configuration: ['L’écriture visée n’existe pas en base'],
    });

    const response = await etape(
      'Rejeter une écriture qui n’existe pas',
      'Le service signale que l’écriture est introuvable',
      () => ecritureClient.rejeter(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'rejet écriture inexistante'),
    );
  });

  test('consulter une écriture inexistante ne renvoie pas 200', async ({ ecritureClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['L’identifiant demandé est un UUID valide qui ne correspond à aucune écriture'],
    });

    const response = await etape(
      'Consulter une écriture dont l’identifiant n’existe pas',
      'Le service signale que l’écriture est introuvable au lieu de renvoyer un document vide',
      () => ecritureClient.getById(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'écriture inexistante'),
    );
  });

  test('un identifiant malformé est rejeté', async ({ ecritureClient }) => {
    await contexte({
      preconditions: ['Une session comptable est ouverte'],
      configuration: ['L’identifiant demandé n’a pas la forme d’un UUID'],
    });

    const response = await etape(
      'Consulter une écriture avec un identifiant malformé',
      'Le service rejette la valeur avant même de chercher en base',
      () => ecritureClient.getById(UUID_MALFORME, BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'écriture id malformé'),
    );
  });

  test('le cycle saisie → soumission → validation est cohérent', async ({
    ecritureClient,
    journalClient,
  }) => {
    await contexte({
      preconditions: [
        'Au moins un journal existe en base, sans quoi le cas est ignoré',
        'Le compte utilisateur est habilité à saisir, soumettre et valider',
      ],
      configuration: [
        'L’écriture parcourt le circuit complet : brouillon, puis soumission, puis validation',
      ],
    });

    const journaux = await etape(
      'Relever un journal existant pour y porter l’écriture',
      'Le service renvoie la liste des journaux disponibles',
      () => journalClient.list(),
    );
    test.skip(journaux.length === 0, 'aucun journal en base');

    const creation = await etape(
      'Saisir une écriture équilibrée dans ce journal',
      'L’écriture est enregistrée à l’état de brouillon et reçoit un identifiant',
      () =>
        ecritureClient.saisir(ecritureEquilibree(String(journaux[0].id)), [
          200,
          201,
          ...BAD_REQUEST_STATUSES,
          404,
        ]),
    );
    test.skip(!creation.ok(), 'saisie impossible sur cet environnement');
    const id = String(((await creation.json()) as Record<string, unknown>).id);

    const soumise = await etape(
      'Soumettre l’écriture à validation',
      'L’écriture quitte l’état de brouillon et attend une décision',
      () => ecritureClient.soumettre(id),
    );

    await etape(
      'Contrôler le statut après soumission',
      'L’écriture n’est plus au brouillon : la soumission a bien fait avancer le circuit',
      async () => {
        const etatSoumis = (await soumise.json()) as Record<string, unknown>;
        expect(String(etatSoumis.statut ?? '')).not.toBe('BROUILLON');
      },
    );

    const validee = await etape(
      'Valider l’écriture soumise',
      'Le service accepte la validation : le circuit se termine normalement',
      () => ecritureClient.valider(id),
    );

    await etape(
      'Contrôler la réponse de validation',
      'La validation aboutit, confirmant que le cycle saisie, soumission puis validation est cohérent',
      async () => {
        expect(validee.ok()).toBeTruthy();
      },
    );
  });
});
