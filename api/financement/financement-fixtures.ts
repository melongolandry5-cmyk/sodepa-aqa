import { baseTest, BaseTestFixtures, BaseWorkerFixtures } from '../../helpers/base-fixtures';
import { FinancementClient } from './client/financement-client';
import { BanqueClient, TiersClient } from '../comptabilite_generale/client/referentiel-client';
import { UserClient } from '../user_management/client/user-client';

/**
 * Clients injectes dans les tests du module Financement.
 *
 * Les clients Banque, Tiers et Utilisateur viennent d'autres modules : creer un
 * financement suppose une banque et un utilisateur existants, un engagement
 * hors-bilan suppose un tiers.
 */
interface FinancementFixtures {
  financementClient: FinancementClient;
  banqueClient: BanqueClient;
  tiersClient: TiersClient;
  userClient: UserClient;
}

export const test = baseTest.extend<FinancementFixtures & BaseTestFixtures, BaseWorkerFixtures>({
  financementClient: async ({ apiContext }, use) => use(new FinancementClient(apiContext)),
  banqueClient: async ({ apiContext }, use) => use(new BanqueClient(apiContext)),
  tiersClient: async ({ apiContext }, use) => use(new TiersClient(apiContext)),
  userClient: async ({ apiContext }, use) => use(new UserClient(apiContext)),
});

export { expect } from '@playwright/test';
