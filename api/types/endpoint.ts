import { HttpMethod } from '../../helpers/http';

/**
 * Description d'une route exposée par le backend.
 *
 * Chaque module déclare ses routes dans son fichier `*-api-paths.ts` ;
 * `api/system_core` les agrège pour les tests transverses (sécurité, surface).
 */
export interface EndpointDescriptor {
  method: HttpMethod;
  path: string;
  /** Module fonctionnel propriétaire de la route. */
  domain: string;
  /** Route accessible sans jeton (cf. SecurityConfig.PUBLIC_ENDPOINTS). */
  public?: boolean;
  /** Route modifiant l'état de façon difficilement réversible. */
  destructive?: boolean;
  /** Route attendant un corps multipart : non sollicitée par les tests génériques. */
  multipart?: boolean;
  /** Corps minimal permettant d'atteindre la route (tests de sécurité). */
  sampleBody?: unknown;
  /** Paramètres de requête minimaux. */
  sampleParams?: Record<string, string | number | boolean>;
}

/** UUID syntaxiquement valide mais absent de la base, utilisé dans les gabarits. */
export const UUID_ZERO = '00000000-0000-0000-0000-000000000000';

/** Date de référence des corps d'exemple. */
export const DATE_ECHANTILLON = '2025-01-01';
