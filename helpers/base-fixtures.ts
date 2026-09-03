import { test as base, request as playwrightRequest, APIRequestContext } from '@playwright/test';
import { env } from './env';
import { logger } from './logger';
import { defaultApiHeaders } from './http';
import { reprendreSur429 } from './rate-limit';
import { users, TestUser } from '../test-data/users';
import { TokenResponse } from '../api/types/common';
import { AUTH_PATHS } from '../api/authentication/authentication-api-paths';

/** Fixtures partagées par worker : le jeton n'est obtenu qu'une fois. */
export interface BaseWorkerFixtures {
  session: TokenResponse;
}

/** Fixtures disponibles dans tous les tests API, quel que soit le module. */
export interface BaseTestFixtures {
  /** Contexte HTTP authentifié (Bearer) sur API_BASE_URL. */
  apiContext: APIRequestContext;
  /** Contexte HTTP sans jeton, pour les tests d'accès refusé. */
  anonContext: APIRequestContext;
}

/** Ouvre une session sur /api/auth/login pour l'utilisateur donné. */
export async function login(user: TestUser): Promise<TokenResponse> {
  const context = await playwrightRequest.newContext({
    baseURL: env.apiBaseUrl,
    timeout: env.apiTimeoutMs,
    extraHTTPHeaders: defaultApiHeaders(),
  });
  try {
    const response = await reprendreSur429(
      () =>
        context.post(AUTH_PATHS.login, {
          data: { username: user.username, password: user.password },
        }),
      `connexion de ${user.username}`,
    );
    if (!response.ok()) {
      throw new Error(
        `Connexion impossible pour "${user.username}" (${response.status()}) : ${await response.text()}`,
      );
    }
    const token = (await response.json()) as TokenResponse;
    logger.info(`session ouverte pour ${user.username}`);
    return token;
  } finally {
    await context.dispose();
  }
}

/**
 * Socle de fixtures dont chaque module dérive son propre `*-fixtures.ts` en
 * y branchant ses clients. Les tests n'importent jamais ce fichier
 * directement : ils passent par les fixtures de leur module.
 */
export const baseTest = base.extend<BaseTestFixtures, BaseWorkerFixtures>({
  session: [
    async ({}, use) => {
      await use(await login(users.admin));
    },
    { scope: 'worker' },
  ],

  apiContext: async ({ session }, use) => {
    const context = await playwrightRequest.newContext({
      baseURL: env.apiBaseUrl,
      timeout: env.apiTimeoutMs,
      extraHTTPHeaders: {
        ...defaultApiHeaders(),
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    await use(context);
    await context.dispose();
  },

  anonContext: async ({}, use) => {
    const context = await playwrightRequest.newContext({
      baseURL: env.apiBaseUrl,
      timeout: env.apiTimeoutMs,
      extraHTTPHeaders: defaultApiHeaders(),
    });
    await use(context);
    await context.dispose();
  },
});

export { expect } from '@playwright/test';
