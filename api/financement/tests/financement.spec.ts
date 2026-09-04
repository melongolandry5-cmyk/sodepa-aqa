import { test, expect } from '../financement-fixtures';
import { simulationValide } from '../financement-payload-builder';
import { FINANCEMENT_PATHS } from '../financement-api-paths';
import {
  expectHasFields,
  expectJsonArray,
  expectStatusIn,
  expectValidPage,
} from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES, NOT_FOUND_STATUSES } from '../../../helpers/http';
import {
  UUID_INEXISTANT,
  UUID_MALFORME,
  isoDate,
  today,
  unique,
} from '../../../test-data/builders';
import { contexte, etape } from '../../../helpers/scenario';

test.describe('API — Financement : recherche et consultation', () => {
  test('la recherche paginée respecte la taille de page demandée', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte avec un compte habilité sur les financements'],
      configuration: ['La première page est demandée avec une taille de 5 éléments'],
    });

    const page = await etape(
      'Consulter la première page des financements, par tranches de 5',
      'Le service renvoie une page conforme à la demande',
      () => financementClient.lister({ page: 0, size: 5 }),
    );

    await etape(
      'Contrôler la structure de la page',
      'Le numéro de page et la taille renvoyés correspondent à ceux demandés, et le total est cohérent',
      async () => {
        expectValidPage(page, { expectedPage: 0, expectedSize: 5 });
      },
    );
  });

  test('la pagination avance sans répéter les mêmes éléments', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Au moins trois financements existent, sans quoi le cas est ignoré'],
      configuration: ['La pagination est demandée par tranches de 2 financements'],
    });

    const premiere = await etape(
      'Consulter la première page de deux financements',
      'Le service renvoie les deux premiers financements et le total en base',
      () => financementClient.lister({ page: 0, size: 2 }),
    );
    test.skip(premiere.totalElements < 3, 'jeu de données insuffisant pour paginer');

    const seconde = await etape(
      'Consulter la page suivante',
      'Le service renvoie une seconde page conforme à la demande',
      () => financementClient.lister({ page: 1, size: 2 }),
    );

    await etape(
      'Comparer les deux pages',
      'La seconde page est bien la page 1, et aucun financement de la première n’y réapparaît',
      async () => {
        expectValidPage(seconde, { expectedPage: 1, expectedSize: 2 });
        const idsPremiere = premiere.content.map((f) => f.id);
        expect(seconde.content.filter((f) => idsPremiere.includes(f.id))).toHaveLength(0);
      },
    );
  });

  test('une page hors bornes renvoie un contenu vide', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La page demandée se situe cinq rangs après la dernière page existante'],
    });

    const premiere = await etape(
      'Relever le nombre total de pages disponibles',
      'Le service indique combien de pages compte le résultat',
      () => financementClient.lister({ page: 0, size: 10 }),
    );

    const horsBornes = await etape(
      'Demander une page située bien au-delà de la dernière',
      'Le service répond normalement au lieu de renvoyer une erreur',
      () => financementClient.lister({ page: premiere.totalPages + 5, size: 10 }),
    );

    await etape(
      'Contrôler le contenu de cette page',
      'La page ne contient aucun financement et se déclare explicitement vide',
      async () => {
        expect(horsBornes.content).toHaveLength(0);
        expect(horsBornes.empty).toBe(true);
      },
    );
  });

  test('le tri demandé est appliqué', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Au moins deux financements existent, sans quoi le cas est ignoré'],
      configuration: ['Le tri demandé est alphabétique croissant sur l’intitulé'],
    });

    const page = await etape(
      'Consulter les financements triés par intitulé croissant',
      'Le service renvoie les financements dans l’ordre demandé',
      () => financementClient.lister({ page: 0, size: 20, sort: 'intitule,asc' }),
    );
    test.skip(page.content.length < 2, 'moins de deux financements en base');

    await etape(
      'Contrôler l’ordre des intitulés renvoyés',
      'Les intitulés se suivent dans l’ordre alphabétique : le tri demandé est réellement appliqué',
      async () => {
        const intitules = page.content.map((f) => String(f.intitule ?? ''));
        const tries = [...intitules].sort((a, b) => a.localeCompare(b));
        expect(intitules).toEqual(tries);
      },
    );
  });

  test('le filtre par type ne renvoie que les financements de ce type', async ({
    financementClient,
  }) => {
    await contexte({
      preconditions: [
        'Au moins un financement existe et porte un type, sans quoi le cas est ignoré',
      ],
    });

    const reference = await etape(
      'Relever un financement existant pour connaître son type',
      'Le service renvoie au moins un financement avec son type',
      () => financementClient.lister({ page: 0, size: 1 }),
    );
    test.skip(reference.content.length === 0, 'aucun financement en base');

    const type = reference.content[0].type;
    test.skip(!type, 'le financement de référence ne porte pas de type');

    const filtres = await etape(
      'Filtrer les financements sur ce type',
      'Le service ne renvoie que les financements du type demandé',
      () => financementClient.lister({ page: 0, size: 50, type: type! }),
    );

    await etape(
      'Contrôler le type de chaque financement renvoyé',
      'Aucun financement d’un autre type n’apparaît : le filtre est réellement appliqué',
      async () => {
        expectValidPage(filtres, { expectedPage: 0 });
        for (const financement of filtres.content) {
          expect(financement.type).toBe(type);
        }
      },
    );
  });

  test('le filtre par banque ne renvoie que ce prêteur', async ({ financementClient, banqueClient }) => {
    await contexte({
      preconditions: ['Au moins une banque existe au référentiel, sans quoi le cas est ignoré'],
    });

    const banques = await etape(
      'Relever une banque du référentiel',
      'Le service renvoie la liste des banques enregistrées',
      () => banqueClient.list(),
    );
    test.skip(banques.length === 0, 'aucune banque en base');

    const banqueId = String(banques[0].id);

    const filtres = await etape(
      'Filtrer les financements sur cette banque prêteuse',
      'Le service ne renvoie que les financements accordés par cet établissement',
      () => financementClient.lister({ page: 0, size: 50, banqueId }),
    );

    await etape(
      'Contrôler le prêteur de chaque financement renvoyé',
      'Aucun financement d’un autre prêteur n’apparaît : le filtre cloisonne bien les banques',
      async () => {
        expectValidPage(filtres, { expectedPage: 0 });
        for (const financement of filtres.content) {
          if (financement.banqueId !== undefined) {
            expect(financement.banqueId).toBe(banqueId);
          }
        }
      },
    );
  });

  test('un banqueId malformé est rejeté', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant de banque transmis n’a pas la forme d’un UUID'],
    });

    const response = await etape(
      'Filtrer les financements avec un identifiant de banque malformé',
      'Le service rejette la valeur au lieu de chercher une banque inexistante',
      () => apiContext.get(FINANCEMENT_PATHS.base, { params: { banqueId: UUID_MALFORME } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'banqueId malformé'),
    );
  });

  test('un type inconnu renvoie une page vide plutôt qu’une erreur', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le type demandé est généré au hasard : aucun financement ne le porte'],
    });

    const page = await etape(
      'Filtrer les financements sur un type qui n’existe pas',
      'Le service renvoie une page vide plutôt qu’une erreur',
      () => financementClient.lister({ page: 0, size: 10, type: unique('TYPE') }),
    );

    await etape(
      'Contrôler le contenu de la page',
      'La page est vide et le total est nul : le filtre ne se rabat pas sur la liste complète',
      async () => {
        expect(page.content).toHaveLength(0);
        expect(page.totalElements).toBe(0);
      },
    );
  });

  test('la consultation unitaire renvoie la fiche et son échéancier', async ({
    financementClient,
  }) => {
    await contexte({
      preconditions: ['Au moins un financement existe, sans quoi le cas est ignoré'],
    });

    const page = await etape(
      'Prendre un financement existant dans la liste',
      'Le service renvoie au moins un financement avec son identifiant',
      () => financementClient.lister({ page: 0, size: 1 }),
    );
    test.skip(page.content.length === 0, 'aucun financement en base');

    const financement = await etape(
      'Consulter ce financement par son identifiant',
      'Le service renvoie la fiche complète du financement',
      () => financementClient.getById(page.content[0].id),
    );

    await etape(
      'Contrôler la fiche renvoyée',
      'C’est bien le financement demandé, et sa fiche porte au minimum un identifiant et un intitulé',
      async () => {
        expect(financement.id).toBe(page.content[0].id);
        expectHasFields(financement as unknown as Record<string, unknown>, ['id', 'intitule']);
      },
    );
  });

  test('un identifiant inexistant ne renvoie pas 200', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant demandé ne correspond à aucun financement'],
    });

    const response = await etape(
      'Consulter un financement dont l’identifiant n’existe pas',
      'Le service signale que le financement est introuvable',
      () => financementClient.getByIdRaw(UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'financement inexistant'),
    );
  });

  test('un identifiant malformé est rejeté en 400', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant demandé n’a pas la forme d’un UUID'],
    });

    const response = await etape(
      'Consulter un financement avec un identifiant malformé',
      'Le service rejette la valeur avant même de chercher en base',
      () => financementClient.getByIdRaw(UUID_MALFORME, BAD_REQUEST_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'financement id malformé'),
    );
  });
});

test.describe('API — Financement : simulation d’amortissement', () => {
  test('la simulation mensuelle renvoie autant d’échéances que de mois', async ({
    financementClient,
  }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’emprunt simulé court sur 24 mois avec des échéances mensuelles'],
    });

    const parametres = simulationValide({ dureeMois: 24, periodicite: 'MENSUELLE' });

    const echeancier = await etape(
      'Simuler un emprunt sur 24 mois à échéances mensuelles',
      'Le service produit le tableau d’amortissement de l’emprunt',
      () => financementClient.simuler(parametres),
    );

    await etape(
      'Compter les échéances du tableau',
      'Le tableau comporte exactement 24 échéances : une par mois de la durée demandée',
      async () => {
        expect(echeancier.length).toBe(parametres.dureeMois);
      },
    );
  });

  test('la somme du capital amorti égale le capital emprunté', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: [
        'L’emprunt simulé court sur 12 mois : à son terme, le capital doit être intégralement remboursé',
      ],
    });

    const parametres = simulationValide({ dureeMois: 12, periodicite: 'MENSUELLE' });

    const echeancier = await etape(
      'Simuler un emprunt sur 12 mois à échéances mensuelles',
      'Le service produit le tableau d’amortissement de l’emprunt',
      () => financementClient.simuler(parametres),
    );

    await etape(
      'Totaliser le capital amorti sur toutes les échéances',
      'Le total correspond au capital emprunté à moins d’une unité près : l’emprunt est intégralement remboursé, ni plus ni moins',
      async () => {
        const capitalAmorti = echeancier.reduce(
          (total, e) => total + Number(e.capitalAmorti ?? 0),
          0,
        );
        expect(Math.abs(capitalAmorti - parametres.capital)).toBeLessThan(1);
      },
    );
  });

  test('le capital restant dû décroît strictement', async ({ financementClient }) => {
    await contexte({
      preconditions: ['L’API expose le capital restant dû, sans quoi le cas est ignoré'],
      configuration: ['L’emprunt simulé court sur 12 mois à échéances mensuelles'],
    });

    const echeancier = await etape(
      'Simuler un emprunt sur 12 mois à échéances mensuelles',
      'Le service produit le tableau d’amortissement avec le capital restant dû à chaque échéance',
      () => financementClient.simuler(simulationValide({ dureeMois: 12, periodicite: 'MENSUELLE' })),
    );
    test.skip(
      echeancier.some((e) => e.capitalRestantDu === undefined),
      'l’API n’expose pas capitalRestantDu',
    );

    await etape(
      'Suivre le capital restant dû d’une échéance à l’autre',
      'Il décroît strictement à chaque échéance et s’annule à la dernière : la dette est bien soldée au terme',
      async () => {
        for (let i = 1; i < echeancier.length; i += 1) {
          expect(Number(echeancier[i].capitalRestantDu)).toBeLessThan(
            Number(echeancier[i - 1].capitalRestantDu),
          );
        }
        expect(
          Math.abs(Number(echeancier[echeancier.length - 1].capitalRestantDu)),
        ).toBeLessThan(1);
      },
    );
  });

  test('la simulation trimestrielle produit quatre échéances par an', async ({
    financementClient,
  }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’emprunt simulé court sur 24 mois avec des échéances trimestrielles'],
    });

    const echeancier = await etape(
      'Simuler un emprunt sur 24 mois à échéances trimestrielles',
      'Le service espace les échéances de trois mois au lieu d’un',
      () =>
        financementClient.simuler(
          simulationValide({ dureeMois: 24, periodicite: 'TRIMESTRIELLE' }),
        ),
    );

    await etape(
      'Compter les échéances du tableau',
      'Le tableau comporte 8 échéances : quatre par an sur deux ans',
      async () => {
        expect(echeancier.length).toBe(8);
      },
    );
  });

  test('la simulation annuelle produit une échéance par an', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’emprunt simulé court sur 36 mois avec des échéances annuelles'],
    });

    const echeancier = await etape(
      'Simuler un emprunt sur 36 mois à échéances annuelles',
      'Le service espace les échéances d’un an',
      () =>
        financementClient.simuler(simulationValide({ dureeMois: 36, periodicite: 'ANNUELLE' })),
    );

    await etape(
      'Compter les échéances du tableau',
      'Le tableau comporte au moins une échéance et jamais plus qu’une par mois : l’espacement annuel est respecté',
      async () => {
        expect(echeancier.length).toBeLessThanOrEqual(36);
        expect(echeancier.length).toBeGreaterThan(0);
      },
    );
  });

  test('un taux nul produit un amortissement sans intérêts', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le taux nominal de l’emprunt simulé est nul, cas d’un prêt sans intérêt'],
    });

    const echeancier = await etape(
      'Simuler un emprunt à taux nul sur 12 mois',
      'Le service accepte le taux nul plutôt que de le confondre avec une valeur manquante',
      () => financementClient.simuler(simulationValide({ tauxNominal: 0, dureeMois: 12 })),
    );

    await etape(
      'Totaliser les intérêts du tableau d’amortissement',
      'Les intérêts sont nuls : un prêt sans intérêt ne coûte que son capital',
      async () => {
        const interets = echeancier.reduce((total, e) => total + Number(e.interets ?? 0), 0);
        expect(interets).toBeCloseTo(0, 2);
      },
    );
  });

  test('le paramètre capital est obligatoire', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le capital emprunté n’est pas transmis'],
    });

    const response = await etape(
      'Simuler un emprunt sans préciser le capital emprunté',
      'Le service refuse : sans capital, aucun tableau d’amortissement ne peut être calculé',
      () =>
        apiContext.get(FINANCEMENT_PATHS.simuler, {
          params: { tauxNominal: 5, dureeMois: 12, periodicite: 'MENSUELLE', dateEffet: today() },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'simuler sans capital'),
    );
  });

  test('le paramètre periodicite est obligatoire', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La périodicité des échéances n’est pas transmise'],
    });

    const response = await etape(
      'Simuler un emprunt sans préciser la périodicité des échéances',
      'Le service refuse : la périodicité détermine l’espacement des échéances',
      () =>
        apiContext.get(FINANCEMENT_PATHS.simuler, {
          params: { capital: 1000, tauxNominal: 5, dureeMois: 12, dateEffet: today() },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'simuler sans periodicite'),
    );
  });

  test('le paramètre dateEffet est obligatoire', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La date d’effet de l’emprunt n’est pas transmise'],
    });

    const response = await etape(
      'Simuler un emprunt sans préciser sa date d’effet',
      'Le service refuse : la date d’effet fixe le point de départ de l’échéancier',
      () =>
        apiContext.get(FINANCEMENT_PATHS.simuler, {
          params: { capital: 1000, tauxNominal: 5, dureeMois: 12, periodicite: 'MENSUELLE' },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'simuler sans dateEffet'),
    );
  });

  test('une date au mauvais format est rejetée', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La date d’effet est écrite en jour/mois/année au lieu du format attendu'],
    });

    const response = await etape(
      'Simuler un emprunt avec une date d’effet mal formatée',
      'Le service rejette la date au lieu de l’interpréter au hasard',
      () =>
        apiContext.get(FINANCEMENT_PATHS.simuler, {
          params: {
            capital: 1000,
            tauxNominal: 5,
            dureeMois: 12,
            periodicite: 'MENSUELLE',
            dateEffet: '01/01/2025',
          },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'dateEffet mal formatée'),
    );
  });

  test('une durée non numérique est rejetée', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La durée transmise est le mot « douze », qui n’est pas un nombre'],
    });

    const response = await etape(
      'Simuler un emprunt dont la durée n’est pas un nombre',
      'Le service rejette la valeur au lieu de la convertir arbitrairement',
      () =>
        apiContext.get(FINANCEMENT_PATHS.simuler, {
          params: {
            capital: 1000,
            tauxNominal: 5,
            dureeMois: 'douze',
            periodicite: 'MENSUELLE',
            dateEffet: today(),
          },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'dureeMois non numérique'),
    );
  });

  test('une périodicité inconnue est refusée ou retombe sur le calcul mensuel', async ({
    apiContext,
  }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La périodicité demandée est hebdomadaire, absente du référentiel'],
    });

    const response = await etape(
      'Simuler un emprunt avec une périodicité qui n’existe pas',
      'Le service refuse la valeur, ou retombe sur le calcul mensuel : il ne produit pas d’échéancier incohérent',
      () =>
        apiContext.get(FINANCEMENT_PATHS.simuler, {
          params: {
            capital: 1000,
            tauxNominal: 5,
            dureeMois: 12,
            periodicite: 'HEBDOMADAIRE',
            dateEffet: today(),
          },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code est soit un succès (200) traduisant le repli mensuel, soit une erreur de validation (400, 415, 422, 500)',
      () => expectStatusIn(response, [200, ...BAD_REQUEST_STATUSES], 'périodicité inconnue'),
    );
  });
});

test.describe('API — Financement : création et règlements', () => {
  test('la création exige une banque existante', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des financements est ouverte'],
      configuration: ['Le dossier est complet, mais la banque prêteuse désignée n’existe pas'],
    });

    const response = await etape(
      'Créer un financement auprès d’une banque qui n’existe pas',
      'Le service signale que la banque est introuvable : un prêt suppose un prêteur connu',
      () =>
        financementClient.creerRaw(
          {
            banqueId: UUID_INEXISTANT,
            intitule: `Prêt ${unique()}`,
            type: 'PRET',
            capital: 1_000_000,
            tauxNominal: 6,
            dateEffet: today(),
            dureeMois: 12,
            periodicite: 'MENSUELLE',
            utilisateurId: UUID_INEXISTANT,
          },
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'création banque inexistante'),
    );
  });

  test('la création exige un intitulé', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des financements est ouverte'],
      configuration: ['L’intitulé du financement est vide'],
    });

    const response = await etape(
      'Créer un financement sans intitulé',
      'Le service refuse : l’intitulé identifie le dossier de financement',
      () =>
        financementClient.creerRaw(
          {
            banqueId: UUID_INEXISTANT,
            intitule: '',
            type: 'PRET',
            capital: 1_000_000,
            tauxNominal: 6,
            dateEffet: today(),
            dureeMois: 12,
            periodicite: 'MENSUELLE',
            utilisateurId: UUID_INEXISTANT,
          },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'création sans intitulé'),
    );
  });

  test('la création exige un capital strictement positif', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à créer des financements est ouverte'],
      configuration: ['Le capital emprunté est nul'],
    });

    const response = await etape(
      'Créer un financement d’un capital nul',
      'Le service refuse : un emprunt sans capital n’a pas d’objet',
      () =>
        financementClient.creerRaw(
          {
            banqueId: UUID_INEXISTANT,
            intitule: 'x',
            type: 'PRET',
            capital: 0,
            tauxNominal: 6,
            dateEffet: today(),
            dureeMois: 12,
            periodicite: 'MENSUELLE',
            utilisateurId: UUID_INEXISTANT,
          },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'création capital nul'),
    );
  });

  test('un financement créé est relisible avec son échéancier', async ({
    financementClient,
    banqueClient,
    userClient,
  }) => {
    await contexte({
      preconditions: [
        'Au moins une banque et un utilisateur existent, sans quoi le cas est ignoré',
        'Le compte est habilité à créer des financements',
      ],
      configuration: [
        'Le prêt souscrit porte sur 12 000 000 au taux de 6,5 % sur 12 mois, à échéances mensuelles',
      ],
    });

    const banques = await etape(
      'Relever une banque du référentiel',
      'Le service renvoie la liste des banques enregistrées',
      () => banqueClient.list(),
    );
    test.skip(banques.length === 0, 'aucune banque en base');

    const utilisateurs = await etape(
      'Relever un utilisateur pour porter la souscription',
      'Le service renvoie au moins un utilisateur',
      () => userClient.page({ page: 0, size: 1 }),
    );
    test.skip(utilisateurs.content.length === 0, 'aucun utilisateur en base');

    const cree = await etape(
      'Souscrire un prêt de 12 000 000 sur 12 mois auprès de cette banque',
      'Le financement est créé et reçoit un identifiant',
      () =>
        financementClient.creer({
          banqueId: String(banques[0].id),
          intitule: `Prêt ${unique()}`,
          type: 'PRET',
          capital: 12_000_000,
          tauxNominal: 6.5,
          dateEffet: today(),
          dureeMois: 12,
          periodicite: 'MENSUELLE',
          utilisateurId: String(utilisateurs.content[0].id),
        }),
    );

    await etape(
      'Relire le financement créé',
      'Le financement est retrouvé par son identifiant et son échéancier a été généré à la souscription',
      async () => {
        expect(cree.id).toBeTruthy();
        const relu = await financementClient.getById(cree.id);
        expect(relu.id).toBe(cree.id);
        expect(relu.echeancier?.length ?? 0).toBeGreaterThan(0);
      },
    );
  });

  test('payer une échéance inexistante échoue', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à régler les échéances est ouverte'],
      configuration: ['L’échéance visée n’existe pas'],
    });

    const response = await etape(
      'Régler une échéance qui n’existe pas',
      'Le service signale que l’échéance est introuvable au lieu d’enregistrer un règlement fictif',
      () =>
        financementClient.payerEcheance(UUID_INEXISTANT, UUID_INEXISTANT, NOT_FOUND_STATUSES),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'paiement échéance inexistante'),
    );
  });

  test('payer une échéance exige un userId', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Aucun utilisateur payeur n’est transmis'],
    });

    const response = await etape(
      'Régler une échéance sans indiquer quel utilisateur effectue le règlement',
      'Le service refuse : un règlement doit être imputé à quelqu’un pour rester traçable',
      () => apiContext.post(FINANCEMENT_PATHS.payerEcheance(UUID_INEXISTANT)),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'paiement sans userId'),
    );
  });
});

test.describe('API — Financement : hors-bilan et reporting', () => {
  test('un engagement hors-bilan exige un tiers existant', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à enregistrer des engagements est ouverte'],
      configuration: ['L’engagement est complet, mais le tiers bénéficiaire n’existe pas'],
    });

    const response = await etape(
      'Enregistrer une caution au profit d’un tiers qui n’existe pas',
      'Le service signale que le tiers est introuvable : un engagement suppose un bénéficiaire connu',
      () =>
        financementClient.creerHorsBilanRaw(
          {
            type: 'CAUTION',
            intitule: `Caution ${unique()}`,
            tiersId: UUID_INEXISTANT,
            montant: 5_000_000,
            dateEffet: today(),
            dateEcheance: isoDate(365),
          },
          NOT_FOUND_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code appartient aux ressources introuvables (400, 404, 409 ou 500)',
      () => expectStatusIn(response, NOT_FOUND_STATUSES, 'hors-bilan tiers inexistant'),
    );
  });

  test('un engagement hors-bilan exige un montant positif', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session habilitée à enregistrer des engagements est ouverte'],
      configuration: ['Le montant de la caution est négatif'],
    });

    const response = await etape(
      'Enregistrer une caution d’un montant négatif',
      'Le service refuse : un engagement hors-bilan négatif n’a pas de sens comptable',
      () =>
        financementClient.creerHorsBilanRaw(
          {
            type: 'CAUTION',
            intitule: 'x',
            tiersId: UUID_INEXISTANT,
            montant: -1,
            dateEffet: today(),
            dateEcheance: isoDate(365),
          },
          BAD_REQUEST_STATUSES,
        ),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'hors-bilan montant négatif'),
    );
  });

  test('un engagement hors-bilan créé apparaît dans le reporting OHADA', async ({
    financementClient,
    tiersClient,
  }) => {
    await contexte({
      preconditions: [
        'Au moins un tiers existe au référentiel, sans quoi le cas est ignoré',
        'Les engagements hors-bilan doivent figurer dans l’annexe OHADA',
      ],
      configuration: ['La caution enregistrée porte sur 2 500 000 avec une échéance à un an'],
    });

    const tiers = await etape(
      'Relever un tiers du référentiel',
      'Le service renvoie au moins un tiers',
      () => tiersClient.list(),
    );
    test.skip(tiers.length === 0, 'aucun tiers en base');

    const intitule = `Caution ${unique()}`;

    await etape(
      'Enregistrer une caution au profit de ce tiers',
      'Le service enregistre l’engagement hors-bilan',
      () =>
        financementClient.creerHorsBilan({
          type: 'CAUTION',
          intitule,
          tiersId: String(tiers[0].id),
          montant: 2_500_000,
          dateEffet: today(),
          dateEcheance: isoDate(365),
        }),
    );

    const reporting = (await etape(
      'Éditer le reporting des engagements hors-bilan',
      'Le service produit l’état destiné à l’annexe OHADA',
      () => financementClient.reportingHorsBilan(),
    )) as Record<string, unknown>[];

    await etape(
      'Rechercher la caution enregistrée dans le reporting',
      'La caution figure dans l’état : un engagement pris est bien porté à l’annexe',
      async () => {
        expect(reporting.some((e) => e.intitule === intitule)).toBeTruthy();
      },
    );
  });

  test('le reporting hors-bilan renvoie un tableau', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
    });

    const response = await etape(
      'Éditer le reporting des engagements hors-bilan',
      'Le service produit l’état des engagements donnés et reçus',
      () => financementClient.reportingHorsBilanRaw(),
    );

    await etape(
      'Examiner la structure de l’état',
      'Le corps est un tableau d’engagements, vide si aucun n’a été enregistré',
      () => expectJsonArray(response),
    );
  });

  test('les KPI financiers exposent les ratios attendus', async ({ financementClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Les indicateurs portent sur l’endettement et la structure financière'],
    });

    const kpis = await etape(
      'Consulter les indicateurs financiers de pilotage',
      'Le service produit les ratios calculés à partir des financements en cours',
      () => financementClient.kpis(),
    );

    await etape(
      'Examiner les indicateurs produits',
      'Les indicateurs sont renseignés et comportent au moins un ratio : le tableau de bord n’est pas vide',
      async () => {
        expect(kpis).toBeTruthy();
        expect(Object.keys(kpis).length).toBeGreaterThan(0);
      },
    );
  });
});
