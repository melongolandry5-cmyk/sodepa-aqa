import { baseTest, BaseTestFixtures, BaseWorkerFixtures } from '../../helpers/base-fixtures';
import { AuthClient } from './client/auth-client';

/** Clients injectes dans les tests du module Authentification. */
interface AuthFixtures {
  /** Client authentifie (sessions, changement de mot de passe). */
  authClient: AuthClient;
  /** Client sans jeton (login, refresh, logout : routes publiques). */
  anonAuthClient: AuthClient;
}

export const test = baseTest.extend<AuthFixtures & BaseTestFixtures, BaseWorkerFixtures>({
  authClient: async ({ apiContext }, use) => use(new AuthClient(apiContext)),
  anonAuthClient: async ({ anonContext }, use) => use(new AuthClient(anonContext)),
});

export { expect } from '@playwright/test';
