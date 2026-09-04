import { test, expect } from '../system-core-fixtures';
import {
  ALL_ENDPOINTS,
  PROTECTED_ENDPOINTS,
  ROUTE_INEXISTANTE,
  ROUTE_PROTEGEE_TEMOIN,
} from '../system-core-api-paths';
import { probe, UNAUTHENTICATED_STATUSES } from '../../../helpers/http';
import { expectStatusIn } from '../../../helpers/assertions';
import { contexte, etape } from '../../../helpers/scenario';

/**
 * Couverture transverse de la chaîne de sécurité.
 *
 * `SecurityConfig` n'ouvre que Swagger, /actuator, /error et les trois routes
 * d'authentification : toute autre route doit refuser un appel non authentifié.
 * La liste vient du registre agrégé, donc une route ajoutée à un module est
 * automatiquement couverte ici.
 */
test.describe('API — Sécurité', () => {
  for (const endpoint of PROTECTED_ENDPOINTS) {
    test(`${endpoint.method.toUpperCase()} ${endpoint.path} refuse un appel sans jeton`, async ({
      anonContext,
    }) => {
      // Les libellés restent littéraux : ce cas est décliné pour chaque route
      // protégée du registre, et la route visée figure déjà dans le titre.
      await contexte({
        preconditions: [
          'La route visée est déclarée protégée dans le registre agrégé des modules',
          'Aucune session n’est ouverte : la requête part sans en-tête Authorization',
        ],
      });

      const response = await etape(
        'Appeler la route protégée sans présenter de jeton',
        'Le service refuse l’accès au lieu de traiter la demande',
        () =>
          probe(anonContext, endpoint.method, endpoint.path, {
            params: endpoint.sampleParams,
            data: endpoint.sampleBody,
          }),
      );

      await etape(
        'Contrôler le code retour',
        'Le service répond 401 ou 403 : l’accès est refusé faute d’authentification',
        () =>
          expectStatusIn(
            response,
            UNAUTHENTICATED_STATUSES,
            `${endpoint.method.toUpperCase()} ${endpoint.path} sans jeton`,
          ),
      );
    });
  }

  test('un jeton malformé est rejeté', async ({ anonContext }) => {
    await contexte({
      preconditions: ['Une route protégée témoin sert de cible'],
      configuration: ['L’en-tête Authorization porte une valeur qui n’est pas un JWT'],
    });

    const response = await etape(
      'Appeler une route protégée avec un jeton qui n’a pas la forme d’un JWT',
      'Le service rejette le jeton sans tenter de l’interpréter',
      () =>
        anonContext.get(ROUTE_PROTEGEE_TEMOIN, {
          headers: { Authorization: 'Bearer pas-un-jwt' },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le service répond 401 ou 403 : un jeton illisible ne vaut pas authentification',
      () => expectStatusIn(response, UNAUTHENTICATED_STATUSES, 'jeton malformé'),
    );
  });

  test('un jeton tronqué est rejeté', async ({ anonContext, session }) => {
    await contexte({
      preconditions: ['Une session valide existe, dont le jeton sert de base'],
      configuration: [
        'Les dix derniers caractères du jeton sont retirés, ce qui invalide sa signature',
      ],
    });

    const tronque = session.access_token.slice(0, -10);

    const response = await etape(
      'Appeler une route protégée avec un jeton amputé de sa fin',
      'Le service détecte que la signature ne correspond plus et refuse l’accès',
      () =>
        anonContext.get(ROUTE_PROTEGEE_TEMOIN, {
          headers: { Authorization: `Bearer ${tronque}` },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le service répond 401 ou 403 : un jeton altéré n’ouvre aucun accès',
      () => expectStatusIn(response, UNAUTHENTICATED_STATUSES, 'jeton tronqué'),
    );
  });

  test('un en-tête Authorization sans schéma Bearer est rejeté', async ({
    anonContext,
    session,
  }) => {
    await contexte({
      preconditions: ['Une session valide existe, dont le jeton est parfaitement valide'],
      configuration: ['Le jeton est envoyé seul, sans le préfixe « Bearer » attendu'],
    });

    const response = await etape(
      'Appeler une route protégée en transmettant le jeton sans son schéma',
      'Le service exige le schéma Bearer et refuse un en-tête mal formé, même avec un jeton valide',
      () =>
        anonContext.get(ROUTE_PROTEGEE_TEMOIN, {
          headers: { Authorization: session.access_token },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le service répond 401 ou 403 : la forme de l’en-tête fait partie du contrat',
      () => expectStatusIn(response, UNAUTHENTICATED_STATUSES, 'schéma manquant'),
    );
  });

  test('les routes publiques restent joignables sans jeton', async ({ anonContext }) => {
    await contexte({
      preconditions: [
        'Le registre agrégé déclare un ensemble de routes comme publiques',
        'Aucune session n’est ouverte',
      ],
    });

    await etape(
      'Appeler sans jeton chacune des routes déclarées publiques',
      'Aucune ne répond 401 ni 403 : une route annoncée publique doit rester atteignable',
      async () => {
        for (const endpoint of ALL_ENDPOINTS.filter((e) => e.public)) {
          const response = await probe(anonContext, endpoint.method, endpoint.path, {
            data: endpoint.sampleBody,
          });

          expect(
            UNAUTHENTICATED_STATUSES,
            `${endpoint.path} est censée être publique (statut ${response.status()})`,
          ).not.toContain(response.status());
        }
      },
    );
  });

  test('une route inexistante renvoie 404 et non 403', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session valide est ouverte'],
      configuration: ['La route appelée n’existe dans aucun contrôleur'],
    });

    const response = await etape(
      'Appeler une route qui n’existe pas, en étant authentifié',
      'Le service annonce que la ressource est introuvable plutôt que de refuser l’accès',
      () => apiContext.get(ROUTE_INEXISTANTE),
    );

    await etape(
      'Contrôler le code retour',
      'Le service répond 404 : un 403 masquerait l’absence de route derrière un refus de droits',
      async () => {
        expect(response.status()).toBe(404);
      },
    );
  });
});
