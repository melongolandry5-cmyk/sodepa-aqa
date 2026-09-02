import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient } from '../../../helpers/base-api-client';
import { AUDIT_PATHS } from '../audit-api-paths';

/** Client du journal technique : /api/auth/audit. */
export class AuditClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async mesActivites(expectStatus?: number[]): Promise<APIResponse> {
    return this.get(AUDIT_PATHS.activities, { expectStatus });
  }

  async transactionsClickHouse(limit?: number, expectStatus?: number[]): Promise<APIResponse> {
    return this.get(AUDIT_PATHS.clickhouseTransactions, {
      params: limit === undefined ? undefined : { limit },
      expectStatus,
    });
  }

  async activitesClickHouse(limit?: number, expectStatus?: number[]): Promise<APIResponse> {
    return this.get(AUDIT_PATHS.clickhouseActivities, {
      params: limit === undefined ? undefined : { limit },
      expectStatus,
    });
  }

  async requeteAnalytique(query: string, expectStatus?: number[]): Promise<APIResponse> {
    return this.get(AUDIT_PATHS.analytics, { params: { query }, expectStatus });
  }
}

/** Client de la piste d'audit métier : /api/audit/logs. */
export class AuditTrailClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async logs(entiteNom: string, entiteId: string, expectStatus?: number[]): Promise<APIResponse> {
    return this.get(AUDIT_PATHS.trailLogs, { params: { entiteNom, entiteId }, expectStatus });
  }
}
