/** Enveloppe de pagination renvoyée par le backend (utils.PageRecord). */
export interface PageRecord<T> {
  content: T[];
  empty: boolean;
  first: boolean;
  last: boolean;
  number: number;
  numberOfElements: number;
  size: number;
  totalElements: number;
  totalPages: number;
  pageable?: unknown;
  sort?: unknown;
}

/** Paramètres de pagination Spring Data. */
export interface PageQuery {
  page?: number;
  size?: number;
  /** Ex. `dateEffet,desc`. */
  sort?: string;
}

/** Réponse Keycloak renvoyée par POST /api/auth/login. */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  token_type: string;
  scope?: string;
}

/** Corps d'erreur normalisé par GestionnaireErreursApi. */
export interface ApiError {
  status?: number;
  message?: string;
  detail?: string;
  title?: string;
  [key: string]: unknown;
}
