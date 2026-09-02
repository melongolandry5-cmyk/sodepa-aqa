import { baseTest, BaseTestFixtures, BaseWorkerFixtures } from '../../helpers/base-fixtures';
import {
  BanqueClient,
  CompteClient,
  JournalClient,
  TiersClient,
} from './client/referentiel-client';
import { EcritureClient } from './client/ecriture-client';
import { ImmobilisationClient } from './client/immobilisation-client';
import { ClotureClient, RapprochementClient } from './client/rapprochement-client';
import { ReportingClient } from './client/reporting-client';

/** Clients injectes dans les tests du module Comptabilite generale. */
interface ComptaFixtures {
  banqueClient: BanqueClient;
  compteClient: CompteClient;
  tiersClient: TiersClient;
  journalClient: JournalClient;
  ecritureClient: EcritureClient;
  immobilisationClient: ImmobilisationClient;
  rapprochementClient: RapprochementClient;
  clotureClient: ClotureClient;
  reportingClient: ReportingClient;
}

export const test = baseTest.extend<ComptaFixtures & BaseTestFixtures, BaseWorkerFixtures>({
  banqueClient: async ({ apiContext }, use) => use(new BanqueClient(apiContext)),
  compteClient: async ({ apiContext }, use) => use(new CompteClient(apiContext)),
  tiersClient: async ({ apiContext }, use) => use(new TiersClient(apiContext)),
  journalClient: async ({ apiContext }, use) => use(new JournalClient(apiContext)),
  ecritureClient: async ({ apiContext }, use) => use(new EcritureClient(apiContext)),
  immobilisationClient: async ({ apiContext }, use) => use(new ImmobilisationClient(apiContext)),
  rapprochementClient: async ({ apiContext }, use) => use(new RapprochementClient(apiContext)),
  clotureClient: async ({ apiContext }, use) => use(new ClotureClient(apiContext)),
  reportingClient: async ({ apiContext }, use) => use(new ReportingClient(apiContext)),
});

export { expect } from '@playwright/test';
