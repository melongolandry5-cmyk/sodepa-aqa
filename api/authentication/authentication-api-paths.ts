import { DATE_ECHANTILLON, EndpointDescriptor, UUID_ZERO } from '../types/endpoint';

const BASE = '/api/auth';

/** Chemins du module Authentification. */
export const AUTH_PATHS = {
  base: BASE,
  login: `${BASE}/login`,
  refresh: `${BASE}/refresh`,
  logout: `${BASE}/logout`,
  sessions: `${BASE}/sessions`,
  session: (sessionId: string) => `${BASE}/sessions/${sessionId}`,
  changePassword: `${BASE}/change-password`,
} as const;

/** Routes du module, agrégées par `api/system_core`. */
export const AUTH_ENDPOINTS: EndpointDescriptor[] = [
  {
    method: 'post',
    path: AUTH_PATHS.login,
    domain: 'authentication',
    public: true,
    sampleBody: { username: 'x', password: 'y' },
  },
  {
    method: 'post',
    path: AUTH_PATHS.refresh,
    domain: 'authentication',
    public: true,
    sampleBody: { refreshToken: 'x' },
  },
  {
    method: 'post',
    path: AUTH_PATHS.logout,
    domain: 'authentication',
    public: true,
    sampleBody: { refreshToken: 'x' },
  },
  { method: 'get', path: AUTH_PATHS.sessions, domain: 'authentication' },
  {
    method: 'delete',
    path: AUTH_PATHS.session(UUID_ZERO),
    domain: 'authentication',
    destructive: true,
  },
  {
    method: 'post',
    path: AUTH_PATHS.changePassword,
    domain: 'authentication',
    destructive: true,
    sampleBody: { newPassword: 'Aa1!aaaa' },
  },
];

export { DATE_ECHANTILLON, UUID_ZERO };
