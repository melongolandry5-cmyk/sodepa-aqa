import { test } from '@playwright/test';

/**
 * Description metier d'un cas de test.
 * ---------------------------------------------------------------------------
 * Un cas se lit a deux endroits : dans Allure apres l'execution, et dans
 * Squash TM comme specification. Les deux doivent raconter la meme chose, sans
 * quoi la documentation derive du code des la premiere modification. La
 * declaration est donc unique et lue deux fois :
 *
 *   - a l'execution, pour nommer les etapes du rapport et y porter le resultat
 *     attendu, afin qu'un echec se lise sans ouvrir le code ;
 *   - statiquement par `scripts/scenario-parse.mjs`, qui en tire les prerequis
 *     et les etapes du cas Squash.
 *
 * La seconde lecture impose une contrainte de forme : les libelles doivent
 * rester des chaines litterales. Une variable ne dirait rien au lecteur du cas
 * dans Squash, puisque le catalogue est bati sans executer les tests.
 */

/** Ce qui doit etre vrai avant de derouler le cas. */
export interface Contexte {
  /** Etat attendu du systeme ou des donnees. */
  preconditions?: string[];
  /** Reglages d'environnement dont depend le cas. */
  configuration?: string[];
}

function liste(titre: string, entrees: string[]): string {
  if (!entrees.length) return '';
  const items = entrees.map((e) => `<li>${e}</li>`).join('');
  return `<p><strong>${titre}</strong></p><ul>${items}</ul>`;
}

/**
 * Declare les prerequis du cas.
 *
 * A appeler en premiere instruction du test. Les entrees deviennent la
 * description du cas dans Allure et des annotations dans le rapport HTML de
 * Playwright ; la synchronisation Squash les reprend en prerequis.
 *
 * L'enrichissement Allure passe par un import dynamique : si le rapport n'est
 * pas actif, le test s'execute quand meme.
 */
export async function contexte({
  preconditions = [],
  configuration = [],
}: Contexte): Promise<void> {
  const info = test.info();
  for (const p of preconditions) info.annotations.push({ type: 'Precondition', description: p });
  for (const c of configuration) info.annotations.push({ type: 'Configuration', description: c });

  const html = liste('Preconditions', preconditions) + liste('Configuration', configuration);
  if (!html) return;
  try {
    const { description } = await import('allure-js-commons');
    await description(html);
  } catch {
    // rapport Allure inactif : les annotations Playwright suffisent
  }
}

/**
 * Deroule une etape du cas.
 *
 * `action` decrit ce que fait l'utilisateur, `attendu` ce que le systeme doit
 * repondre. Le resultat attendu est emis comme sous-etape avant l'execution du
 * corps, pour deux raisons : il reste visible sans deplier de piece jointe, et
 * il est present meme quand le corps echoue — c'est precisement le moment ou
 * l'on veut lire ce qui etait vise a cote de ce qui s'est produit.
 *
 * Les parametres d'etape d'allure-js-commons ne conviennent pas ici : ils sont
 * rattaches au cas, pas a l'etape, et plusieurs « resultat attendu » s'y
 * melangent sans qu'on sache lequel va avec quelle action.
 *
 * La valeur renvoyee par `corps` est propagee, pour enchainer les etapes sans
 * variable intermediaire.
 */
export async function etape<T>(
  action: string,
  attendu: string,
  corps: () => Promise<T> | T,
): Promise<T> {
  return test.step(action, async () => {
    if (attendu) await test.step(`Attendu : ${attendu}`, async () => {});
    return corps();
  });
}
