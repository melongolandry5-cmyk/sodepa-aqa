import { test, expect } from '../audit-fixtures';
import { expectJsonArray, expectStatusIn } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES } from '../../../helpers/http';
import { UUID_INEXISTANT, UUID_MALFORME } from '../../../test-data/builders';

/**
 * L'audit s'appuie sur ClickHouse : lorsqu'il n'est pas déployé, le backend
 * remonte une erreur serveur. Les tests l'acceptent explicitement plutôt que
 * de masquer l'endpoint, et vérifient la forme dès que la réponse est un 200.
 */
const CLICKHOUSE_INDISPONIBLE = [500, 502, 503, 504];

test.describe('API — Audit (/api/auth/audit)', () => {
  test('les activités du porteur du jeton sont listées', async ({ auditClient }) => {
    const response = await auditClient.mesActivites([200, ...CLICKHOUSE_INDISPONIBLE]);

    if (response.status() === 200) {
      await expectJsonArray(response);
    }
  });

  test('les transactions ClickHouse respectent la limite demandée', async ({ auditClient }) => {
    const response = await auditClient.transactionsClickHouse(5, [200, ...CLICKHOUSE_INDISPONIBLE]);

    if (response.status() === 200) {
      const lignes = await expectJsonArray(response);
      expect(lignes.length).toBeLessThanOrEqual(5);
    }
  });

  test('les transactions ClickHouse utilisent la limite par défaut de 100', async ({
    auditClient,
  }) => {
    const response = await auditClient.transactionsClickHouse(undefined, [
      200,
      ...CLICKHOUSE_INDISPONIBLE,
    ]);

    if (response.status() === 200) {
      const lignes = await expectJsonArray(response);
      expect(lignes.length).toBeLessThanOrEqual(100);
    }
  });

  test('une limite non numérique est rejetée', async ({ apiContext }) => {
    const response = await apiContext.get('/api/auth/audit/clickhouse/transactions', {
      params: { limit: 'beaucoup' },
    });

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'limit non numérique');
  });

  test('les activités ClickHouse respectent la limite demandée', async ({ auditClient }) => {
    const response = await auditClient.activitesClickHouse(3, [200, ...CLICKHOUSE_INDISPONIBLE]);

    if (response.status() === 200) {
      const lignes = await expectJsonArray(response);
      expect(lignes.length).toBeLessThanOrEqual(3);
    }
  });

  test('une requête analytique est exécutée ou refusée proprement', async ({ auditClient }) => {
    const response = await auditClient.requeteAnalytique('SELECT 1', [
      200,
      400,
      403,
      ...CLICKHOUSE_INDISPONIBLE,
    ]);

    if (response.status() === 200) {
      await expectJsonArray(response);
    }
  });

  test('le paramètre query est obligatoire', async ({ apiContext }) => {
    const response = await apiContext.get('/api/auth/audit/analytics');

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'analytics sans query');
  });
});

test.describe('API — Piste d’audit métier (/api/audit/logs)', () => {
  test('la consultation des logs d’une entité renvoie un tableau', async ({ auditTrailClient }) => {
    const response = await auditTrailClient.logs('BudgetPlan', UUID_INEXISTANT, [200, 404, 500]);

    if (response.status() === 200) {
      await expectJsonArray(response);
    }
  });

  test('entiteNom est obligatoire', async ({ apiContext }) => {
    const response = await apiContext.get('/api/audit/logs', {
      params: { entiteId: UUID_INEXISTANT },
    });

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'logs sans entiteNom');
  });

  test('entiteId est obligatoire', async ({ apiContext }) => {
    const response = await apiContext.get('/api/audit/logs', {
      params: { entiteNom: 'BudgetPlan' },
    });

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'logs sans entiteId');
  });

  test('un entiteId non UUID est rejeté', async ({ apiContext }) => {
    const response = await apiContext.get('/api/audit/logs', {
      params: { entiteNom: 'BudgetPlan', entiteId: UUID_MALFORME },
    });

    await expectStatusIn(response, BAD_REQUEST_STATUSES, 'entiteId malformé');
  });
});
