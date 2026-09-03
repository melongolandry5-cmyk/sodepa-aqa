import { APIResponse, test } from '@playwright/test';

/** Masque les valeurs sensibles avant publication dans le rapport. */
export function masquer(donnees: unknown): unknown {
  if (!donnees || typeof donnees !== 'object') return donnees;
  const copie: Record<string, unknown> = { ...(donnees as Record<string, unknown>) };
  for (const cle of Object.keys(copie)) {
    if (/password|token|secret/i.test(cle) && typeof copie[cle] === 'string') {
      const valeur = copie[cle] as string;
      copie[cle] = valeur ? `*** (${valeur.length} caracteres)` : '';
    }
  }
  return copie;
}

/**
 * Attache une donnee au rapport (Allure, HTML Playwright).
 *
 * Silencieux hors contexte de test : les fixtures de scope worker s'executent
 * sans `testInfo` et n'ont rien ou attacher.
 */
export async function attacher(nom: string, contenu: unknown): Promise<void> {
  try {
    const corps =
      typeof contenu === 'string' ? contenu : (JSON.stringify(contenu, null, 2) ?? 'undefined');
    await test.info().attach(nom, { body: corps, contentType: 'application/json' });
  } catch {
    // hors test : pas de rapport a enrichir
  }
}

/** Corps de reponse en JSON si possible, sinon en texte tronque. */
export async function corpsLisible(response: APIResponse): Promise<unknown> {
  const texte = await response.text();
  try {
    return masquer(JSON.parse(texte));
  } catch {
    return texte.slice(0, 2000);
  }
}

/**
 * Attache une reponse au rapport.
 *
 * Utilise par les assertions afin que les tests appelant directement un
 * `APIRequestContext` (sans passer par un client) documentent eux aussi les
 * donnees echangees.
 */
export async function attacherReponse(response: APIResponse, nom = 'reponse'): Promise<void> {
  await attacher(nom, {
    statut: response.status(),
    url: response.url(),
    corps: await corpsLisible(response),
  });
}
