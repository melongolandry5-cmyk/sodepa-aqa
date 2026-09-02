import { baseTest, BaseTestFixtures, BaseWorkerFixtures } from '../../helpers/base-fixtures';
import {
  ChangeHedgingClient,
  PilotageClient,
  RapprochementBancaireClient,
  TresorerieClient,
} from './client/tresorerie-client';

/** Clients injectes dans les tests du module Tresorerie. */
interface TresorerieFixtures {
  tresorerieClient: TresorerieClient;
  changeClient: ChangeHedgingClient;
  rapprochementBancaireClient: RapprochementBancaireClient;
  pilotageClient: PilotageClient;
}

export const test = baseTest.extend<TresorerieFixtures & BaseTestFixtures, BaseWorkerFixtures>({
  tresorerieClient: async ({ apiContext }, use) => use(new TresorerieClient(apiContext)),
  changeClient: async ({ apiContext }, use) => use(new ChangeHedgingClient(apiContext)),
  rapprochementBancaireClient: async ({ apiContext }, use) =>
    use(new RapprochementBancaireClient(apiContext)),
  pilotageClient: async ({ apiContext }, use) => use(new PilotageClient(apiContext)),
});

export { expect } from '@playwright/test';
