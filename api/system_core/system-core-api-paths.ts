import { EndpointDescriptor } from '../types/endpoint';
import { AUTH_ENDPOINTS } from '../authentication/authentication-api-paths';
import { AUDIT_ENDPOINTS } from '../audit/audit-api-paths';
import { BUDGET_ENDPOINTS } from '../budget/budget-api-paths';
import { FINANCEMENT_ENDPOINTS } from '../financement/financement-api-paths';
import { TRESORERIE_ENDPOINTS } from '../tresorerie/tresorerie-api-paths';
import { ANALYTIQUE_ENDPOINTS } from '../comptabilite_analytique/comptabilite-analytique-api-paths';
import { COMPTA_ENDPOINTS } from '../comptabilite_generale/comptabilite-generale-api-paths';
import { USER_ENDPOINTS } from '../user_management/user-management-api-paths';

/**
 * Surface REST complète du backend, agrégée depuis les fichiers
 * `*-api-paths.ts` de chaque module.
 *
 * Les tests transverses (sécurité, garde-fou de couverture) travaillent sur
 * cette liste : ajouter un module revient à l'importer ici.
 */
export const ALL_ENDPOINTS: EndpointDescriptor[] = [
  ...AUTH_ENDPOINTS,
  ...AUDIT_ENDPOINTS,
  ...BUDGET_ENDPOINTS,
  ...FINANCEMENT_ENDPOINTS,
  ...TRESORERIE_ENDPOINTS,
  ...ANALYTIQUE_ENDPOINTS,
  ...COMPTA_ENDPOINTS,
  ...USER_ENDPOINTS,
];

/** Routes nécessitant une authentification. */
export const PROTECTED_ENDPOINTS = ALL_ENDPOINTS.filter((e) => !e.public);

/** Routes publiques déclarées par SecurityConfig. */
export const PUBLIC_ENDPOINTS = ALL_ENDPOINTS.filter((e) => e.public);

/** Routes en lecture seule, sûres à appeler en boucle. */
export const READ_ONLY_ENDPOINTS = ALL_ENDPOINTS.filter(
  (e) => e.method === 'get' && !e.destructive,
);
