import { baseTest, BaseTestFixtures, BaseWorkerFixtures } from '../../helpers/base-fixtures';
import { AuditClient, AuditTrailClient } from './client/audit-client';

/** Clients injectes dans les tests du module Audit. */
interface AuditFixtures {
  auditClient: AuditClient;
  auditTrailClient: AuditTrailClient;
}

export const test = baseTest.extend<AuditFixtures & BaseTestFixtures, BaseWorkerFixtures>({
  auditClient: async ({ apiContext }, use) => use(new AuditClient(apiContext)),
  auditTrailClient: async ({ apiContext }, use) => use(new AuditTrailClient(apiContext)),
});

export { expect } from '@playwright/test';
