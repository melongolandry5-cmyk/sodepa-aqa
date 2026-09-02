import { test, expect } from '../system-core-fixtures';
import { ALL_ENDPOINTS, PROTECTED_ENDPOINTS } from '../system-core-api-paths';
import { probe, UNAUTHENTICATED_STATUSES } from '../../../helpers/http';
import { expectStatusIn } from '../../../helpers/assertions';

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
      const response = await probe(anonContext, endpoint.method, endpoint.path, {
        params: endpoint.sampleParams,
        data: endpoint.sampleBody,
      });

      await expectStatusIn(
        response,
        UNAUTHENTICATED_STATUSES,
        `${endpoint.method.toUpperCase()} ${endpoint.path} sans jeton`,
      );
    });
  }

  test('un jeton malformé est rejeté', async ({ anonContext }) => {
    const response = await anonContext.get('/api/financement', {
      headers: { Authorization: 'Bearer pas-un-jwt' },
    });

    await expectStatusIn(response, UNAUTHENTICATED_STATUSES, 'jeton malformé');
  });

  test('un jeton tronqué est rejeté', async ({ anonContext, session }) => {
    const tronque = session.access_token.slice(0, -10);
    const response = await anonContext.get('/api/financement', {
      headers: { Authorization: `Bearer ${tronque}` },
    });

    await expectStatusIn(response, UNAUTHENTICATED_STATUSES, 'jeton tronqué');
  });

  test('un en-tête Authorization sans schéma Bearer est rejeté', async ({
    anonContext,
    session,
  }) => {
    const response = await anonContext.get('/api/financement', {
      headers: { Authorization: session.access_token },
    });

    await expectStatusIn(response, UNAUTHENTICATED_STATUSES, 'schéma manquant');
  });

  test('les routes publiques restent joignables sans jeton', async ({ anonContext }) => {
    for (const endpoint of ALL_ENDPOINTS.filter((e) => e.public)) {
      const response = await probe(anonContext, endpoint.method, endpoint.path, {
        data: endpoint.sampleBody,
      });

      expect(
        UNAUTHENTICATED_STATUSES,
        `${endpoint.path} est censée être publique (statut ${response.status()})`,
      ).not.toContain(response.status());
    }
  });

  test('une route inexistante renvoie 404 et non 403', async ({ apiContext }) => {
    const response = await apiContext.get('/api/route-qui-nexiste-pas');

    expect(response.status()).toBe(404);
  });
});
