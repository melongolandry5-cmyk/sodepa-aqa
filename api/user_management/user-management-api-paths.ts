import { EndpointDescriptor, UUID_ZERO } from '../types/endpoint';

const BASE = '/api/v1/users';

/** Chemins du module Gestion des utilisateurs. */
export const USER_PATHS = {
  base: BASE,
  initCreate: `${BASE}/init_create`,
  pending: `${BASE}/pending`,
  search: `${BASE}/search`,
  byId: (id: string) => `${BASE}/${id}`,
  initUpdate: (id: string) => `${BASE}/init_update/${id}`,
  initChangePhoto: (id: string) => `${BASE}/init_change_photo/${id}`,
  initUpdatePermissions: (id: string) => `${BASE}/init_update_permissions/${id}`,
  decision: (id: string) => `${BASE}/validate_or_reject/${id}`,
} as const;

export const USER_ENDPOINTS: EndpointDescriptor[] = [
  { method: 'post', path: USER_PATHS.initCreate, domain: 'users', multipart: true },
  { method: 'get', path: USER_PATHS.base, domain: 'users' },
  { method: 'get', path: USER_PATHS.pending, domain: 'users' },
  { method: 'get', path: USER_PATHS.search, domain: 'users' },
  { method: 'get', path: USER_PATHS.byId(UUID_ZERO), domain: 'users' },
  {
    method: 'put',
    path: USER_PATHS.initUpdate(UUID_ZERO),
    domain: 'users',
    sampleBody: {
      nom: 'x',
      prenom: 'x',
      email: 'x@y.z',
      telephones: ['690000000'],
      actif: true,
    },
  },
  { method: 'put', path: USER_PATHS.initChangePhoto(UUID_ZERO), domain: 'users', multipart: true },
  {
    method: 'put',
    path: USER_PATHS.initUpdatePermissions(UUID_ZERO),
    domain: 'users',
    sampleBody: { permissions: ['GET_FULL_USER_INFO'] },
  },
  {
    method: 'put',
    path: USER_PATHS.decision(UUID_ZERO),
    domain: 'users',
    sampleBody: { decision: 'ACCEPTED', notes: 'x', checkerOperationType: 'CREATE' },
  },
];
