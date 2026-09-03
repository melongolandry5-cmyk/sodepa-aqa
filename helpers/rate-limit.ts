import { APIResponse } from '@playwright/test';
import { logger } from './logger';

/** Statut renvoye par l'environnement quand le quota d'appels est atteint. */
export const TROP_DE_REQUETES = 429;

/**
 * Delais d'attente successifs avant nouvelle tentative, en millisecondes.
 *
 * L'environnement de test limite /api/auth a une dizaine d'appels par fenetre
 * d'environ une minute et ne renvoie aucun en-tete Retry-After : l'attente est
 * donc aveugle. La fenetre mesuree a vide est de ~40 s, mais une campagne
 * complete consomme le quota en continu : un cumul de 50 s s'est revele
 * insuffisant sur la suite Authentification, d'ou le dernier palier.
 */
const DELAIS_MS = [5_000, 15_000, 30_000, 45_000];

const patienter = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Vrai si l'appelant veut examiner lui-meme la reponse 429. */
export function attendUn429(expectStatus?: number | number[]): boolean {
  if (expectStatus === undefined) return false;
  const attendus = Array.isArray(expectStatus) ? expectStatus : [expectStatus];
  return attendus.includes(TROP_DE_REQUETES);
}

/**
 * Rejoue un appel tant que l'environnement repond 429.
 *
 * Le quota est une contrainte d'infrastructure, pas un comportement du produit :
 * sans cette reprise, une campagne complete l'epuise et les derniers tests
 * echouent sur la connexion au lieu de verifier leur assertion.
 *
 * La derniere reponse est renvoyee telle quelle : si le quota ne se libere pas,
 * l'appelant voit un vrai 429 et le test echoue avec la bonne cause.
 */
export async function reprendreSur429(
  appel: () => Promise<APIResponse>,
  description: string,
): Promise<APIResponse> {
  let response = await appel();
  for (const delai of DELAIS_MS) {
    if (response.status() !== TROP_DE_REQUETES) return response;
    logger.warn(`quota atteint sur ${description} — nouvelle tentative dans ${delai / 1000} s`);
    await patienter(delai);
    response = await appel();
  }
  return response;
}
