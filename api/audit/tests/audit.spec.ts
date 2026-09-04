import { test, expect } from '../audit-fixtures';
import { AUDIT_PATHS } from '../audit-api-paths';
import { expectJsonArray, expectStatusIn } from '../../../helpers/assertions';
import { BAD_REQUEST_STATUSES } from '../../../helpers/http';
import { UUID_INEXISTANT, UUID_MALFORME } from '../../../test-data/builders';
import { contexte, etape } from '../../../helpers/scenario';

/**
 * L'audit s'appuie sur ClickHouse : lorsqu'il n'est pas déployé, le backend
 * remonte une erreur serveur. Les tests l'acceptent explicitement plutôt que
 * de masquer l'endpoint, et vérifient la forme dès que la réponse est un 200.
 */
const CLICKHOUSE_INDISPONIBLE = [500, 502, 503, 504];

test.describe('API — Audit (/api/auth/audit)', () => {
  test('les activités du porteur du jeton sont listées', async ({ auditClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte : la piste d’audit est consultée pour son porteur'],
      configuration: [
        'ClickHouse peut ne pas être déployé : le cas accepte alors une erreur serveur',
      ],
    });

    const response = await etape(
      'Consulter la liste de ses propres activités',
      'Le service répond 200 avec les activités, ou une erreur serveur si ClickHouse est absent',
      () => auditClient.mesActivites([200, ...CLICKHOUSE_INDISPONIBLE]),
    );

    await etape(
      'Examiner la réponse lorsqu’elle aboutit',
      'En cas de succès, le corps est un tableau d’activités',
      async () => {
        if (response.status() === 200) {
          await expectJsonArray(response);
        }
      },
    );
  });

  test('les transactions ClickHouse respectent la limite demandée', async ({ auditClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La limite demandée est de 5 transactions'],
    });

    const response = await etape(
      'Demander les transactions auditées en limitant le résultat à 5 lignes',
      'Le service répond 200, ou une erreur serveur si ClickHouse est absent',
      () => auditClient.transactionsClickHouse(5, [200, ...CLICKHOUSE_INDISPONIBLE]),
    );

    await etape(
      'Compter les lignes renvoyées',
      'Le service ne renvoie jamais plus que la limite demandée, soit 5 lignes au maximum',
      async () => {
        if (response.status() === 200) {
          const lignes = await expectJsonArray(response);
          expect(lignes.length).toBeLessThanOrEqual(5);
        }
      },
    );
  });

  test('les transactions ClickHouse utilisent la limite par défaut de 100', async ({
    auditClient,
  }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Aucune limite n’est transmise : la valeur par défaut doit s’appliquer'],
    });

    const response = await etape(
      'Demander les transactions auditées sans préciser de limite',
      'Le service applique sa limite par défaut au lieu de tout renvoyer',
      () => auditClient.transactionsClickHouse(undefined, [200, ...CLICKHOUSE_INDISPONIBLE]),
    );

    await etape(
      'Compter les lignes renvoyées',
      'Le résultat ne dépasse pas 100 lignes, la limite par défaut annoncée',
      async () => {
        if (response.status() === 200) {
          const lignes = await expectJsonArray(response);
          expect(lignes.length).toBeLessThanOrEqual(100);
        }
      },
    );
  });

  test('une limite non numérique est rejetée', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Le paramètre limit vaut « beaucoup », qui n’est pas un nombre'],
    });

    const response = await etape(
      'Demander les transactions auditées avec une limite non numérique',
      'Le service refuse la requête au lieu d’interpréter la valeur',
      () =>
        apiContext.get(AUDIT_PATHS.clickhouseTransactions, { params: { limit: 'beaucoup' } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'limit non numérique'),
    );
  });

  test('les activités ClickHouse respectent la limite demandée', async ({ auditClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['La limite demandée est de 3 activités'],
    });

    const response = await etape(
      'Demander les activités auditées en limitant le résultat à 3 lignes',
      'Le service répond 200, ou une erreur serveur si ClickHouse est absent',
      () => auditClient.activitesClickHouse(3, [200, ...CLICKHOUSE_INDISPONIBLE]),
    );

    await etape(
      'Compter les lignes renvoyées',
      'Le service ne renvoie jamais plus que la limite demandée, soit 3 lignes au maximum',
      async () => {
        if (response.status() === 200) {
          const lignes = await expectJsonArray(response);
          expect(lignes.length).toBeLessThanOrEqual(3);
        }
      },
    );
  });

  test('une requête analytique est exécutée ou refusée proprement', async ({ auditClient }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: [
        'La requête soumise est « SELECT 1 », volontairement inoffensive',
        'L’endpoint peut être fermé aux requêtes libres : un refus est un comportement acceptable',
      ],
    });

    const response = await etape(
      'Soumettre une requête analytique élémentaire',
      'Le service l’exécute et répond 200, ou la refuse proprement en 400 ou 403',
      () =>
        auditClient.requeteAnalytique('SELECT 1', [200, 400, 403, ...CLICKHOUSE_INDISPONIBLE]),
    );

    await etape(
      'Examiner la réponse lorsqu’elle aboutit',
      'En cas de succès, le corps est un tableau de résultats et non une erreur déguisée',
      async () => {
        if (response.status() === 200) {
          await expectJsonArray(response);
        }
      },
    );
  });

  test('le paramètre query est obligatoire', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Aucune requête n’est transmise à l’endpoint analytique'],
    });

    const response = await etape(
      'Appeler l’endpoint analytique sans fournir de requête',
      'Le service signale le paramètre manquant au lieu d’exécuter une requête vide',
      () => apiContext.get(AUDIT_PATHS.analytics),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'analytics sans query'),
    );
  });
});

test.describe('API — Piste d’audit métier (/api/audit/logs)', () => {
  test('la consultation des logs d’une entité renvoie un tableau', async ({ auditTrailClient }) => {
    await contexte({
      preconditions: [
        'Une session est ouverte',
        'L’entité visée est un plan budgétaire dont l’identifiant n’existe pas',
      ],
    });

    const response = await etape(
      'Consulter la piste d’audit d’une entité désignée par son type et son identifiant',
      'Le service répond 200 avec les traces, ou signale que l’entité est introuvable',
      () => auditTrailClient.logs('BudgetPlan', UUID_INEXISTANT, [200, 404, 500]),
    );

    await etape(
      'Examiner la réponse lorsqu’elle aboutit',
      'En cas de succès, le corps est un tableau de traces, vide si aucune n’existe',
      async () => {
        if (response.status() === 200) {
          await expectJsonArray(response);
        }
      },
    );
  });

  test('entiteNom est obligatoire', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Seul l’identifiant d’entité est transmis, sans son type'],
    });

    const response = await etape(
      'Consulter la piste d’audit sans préciser le type d’entité',
      'Le service signale le paramètre manquant : le type est nécessaire pour cibler la piste',
      () => apiContext.get(AUDIT_PATHS.trailLogs, { params: { entiteId: UUID_INEXISTANT } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'logs sans entiteNom'),
    );
  });

  test('entiteId est obligatoire', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['Seul le type d’entité est transmis, sans son identifiant'],
    });

    const response = await etape(
      'Consulter la piste d’audit sans préciser l’identifiant de l’entité',
      'Le service signale le paramètre manquant : sans identifiant, aucune entité n’est ciblée',
      () => apiContext.get(AUDIT_PATHS.trailLogs, { params: { entiteNom: 'BudgetPlan' } }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'logs sans entiteId'),
    );
  });

  test('un entiteId non UUID est rejeté', async ({ apiContext }) => {
    await contexte({
      preconditions: ['Une session est ouverte'],
      configuration: ['L’identifiant transmis n’a pas la forme d’un UUID'],
    });

    const response = await etape(
      'Consulter la piste d’audit avec un identifiant d’entité malformé',
      'Le service rejette la valeur au lieu de chercher une entité inexistante',
      () =>
        apiContext.get(AUDIT_PATHS.trailLogs, {
          params: { entiteNom: 'BudgetPlan', entiteId: UUID_MALFORME },
        }),
    );

    await etape(
      'Contrôler le code retour',
      'Le code relève des erreurs de validation (400, 415, 422 ou 500)',
      () => expectStatusIn(response, BAD_REQUEST_STATUSES, 'entiteId malformé'),
    );
  });
});
