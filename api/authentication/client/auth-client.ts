import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient } from '../../../helpers/base-api-client';
import { TokenResponse } from '../../types/common';
import { AUTH_PATHS } from '../authentication-api-paths';

/** Client des endpoints /api/auth. */
export class AuthClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  /** Connexion : renvoie la réponse brute (utile pour tester les cas d'échec). */
  async loginRaw(username: string, password: string): Promise<APIResponse> {
    return this.post(AUTH_PATHS.login, {
      data: { username, password },
      expectStatus: [200, 400, 401, 403, 500],
    });
  }

  /** Connexion nominale : échoue le test si le backend ne renvoie pas 200. */
  async login(username: string, password: string): Promise<TokenResponse> {
    const response = await this.post(AUTH_PATHS.login, { data: { username, password } });
    return this.json<TokenResponse>(response);
  }

  async refresh(refreshToken: string): Promise<TokenResponse> {
    const response = await this.post(AUTH_PATHS.refresh, { data: { refreshToken } });
    return this.json<TokenResponse>(response);
  }

  async refreshRaw(refreshToken: string, expectStatus?: number[]): Promise<APIResponse> {
    return this.post(AUTH_PATHS.refresh, { data: { refreshToken }, expectStatus });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.post(AUTH_PATHS.logout, { data: { refreshToken } });
  }

  async listSessions(): Promise<unknown[]> {
    const response = await this.get(AUTH_PATHS.sessions);
    return this.json<unknown[]>(response);
  }

  async deleteSession(sessionId: string, expectStatus?: number[]): Promise<APIResponse> {
    return this.delete(AUTH_PATHS.session(sessionId), { expectStatus });
  }

  async changePassword(newPassword: string, expectStatus?: number[]): Promise<APIResponse> {
    return this.post(AUTH_PATHS.changePassword, { data: { newPassword }, expectStatus });
  }
}
