import { baseTest, BaseTestFixtures, BaseWorkerFixtures } from '../../helpers/base-fixtures';
import {
  AnalytiqueBudgetClient,
  AnalytiqueClient,
  CleRepartitionClient,
  ReportingAnalytiqueClient,
} from './client/analytique-client';

/** Clients injectes dans les tests du module Comptabilite analytique. */
interface AnalytiqueFixtures {
  analytiqueClient: AnalytiqueClient;
  analytiqueBudgetClient: AnalytiqueBudgetClient;
  cleRepartitionClient: CleRepartitionClient;
  reportingAnalytiqueClient: ReportingAnalytiqueClient;
}

export const test = baseTest.extend<AnalytiqueFixtures & BaseTestFixtures, BaseWorkerFixtures>({
  analytiqueClient: async ({ apiContext }, use) => use(new AnalytiqueClient(apiContext)),
  analytiqueBudgetClient: async ({ apiContext }, use) =>
    use(new AnalytiqueBudgetClient(apiContext)),
  cleRepartitionClient: async ({ apiContext }, use) => use(new CleRepartitionClient(apiContext)),
  reportingAnalytiqueClient: async ({ apiContext }, use) =>
    use(new ReportingAnalytiqueClient(apiContext)),
});

export { expect } from '@playwright/test';
