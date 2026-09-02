import { APIRequestContext, APIResponse } from '@playwright/test';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** Options d'un appel brut, sans assertion de statut. */
export interface ProbeOptions {
  params?: Record<string, string | number | boolean>;
  data?: unknown;
  headers?: Record<string, string>;
}

/**
 * Exécute un appel HTTP sans vérifier le code retour.
 *
 * Utilisé par les tests transverses (sécurité, validation) qui s'intéressent
 * précisément aux réponses en erreur.
 */
export async function probe(
  request: APIRequestContext,
  method: HttpMethod,
  path: string,
  options: ProbeOptions = {},
): Promise<APIResponse> {
  switch (method) {
    case 'get':
      return request.get(path, { params: options.params, headers: options.headers });
    case 'delete':
      return request.delete(path, { params: options.params, headers: options.headers });
    case 'post':
      return request.post(path, {
        params: options.params,
        data: options.data as never,
        headers: options.headers,
      });
    case 'put':
      return request.put(path, {
        params: options.params,
        data: options.data as never,
        headers: options.headers,
      });
    case 'patch':
      return request.patch(path, {
        params: options.params,
        data: options.data as never,
        headers: options.headers,
      });
  }
}

/** Codes acceptables lorsqu'un appel doit être refusé faute d'authentification. */
export const UNAUTHENTICATED_STATUSES = [401, 403];

/** Codes acceptables lorsqu'une ressource est introuvable ou inexploitable. */
export const NOT_FOUND_STATUSES = [400, 404, 409, 500];

/** Codes acceptables lorsqu'une requête est invalide. */
export const BAD_REQUEST_STATUSES = [400, 415, 422, 500];
