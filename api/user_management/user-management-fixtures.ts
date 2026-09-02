import { baseTest, BaseTestFixtures, BaseWorkerFixtures } from '../../helpers/base-fixtures';
import { UserClient } from './client/user-client';

/** Clients injectes dans les tests du module Gestion des utilisateurs. */
interface UserFixtures {
  userClient: UserClient;
}

export const test = baseTest.extend<UserFixtures & BaseTestFixtures, BaseWorkerFixtures>({
  userClient: async ({ apiContext }, use) => use(new UserClient(apiContext)),
});

export { expect } from '@playwright/test';
