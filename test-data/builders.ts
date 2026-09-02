/** Générateurs de données de test, isolées par exécution. */

/** Suffixe unique pour éviter les collisions de code métier entre exécutions. */
export function unique(prefix = 'AQA'): string {
  return `${prefix}${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
}

/** Date du jour au format ISO attendu par le backend (yyyy-MM-dd). */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Date décalée de `jours` par rapport à aujourd'hui, au format ISO. */
export function isoDate(jours: number): string {
  const date = new Date();
  date.setDate(date.getDate() + jours);
  return date.toISOString().slice(0, 10);
}

/** Premier jour de l'année donnée. */
export function debutAnnee(annee: number): string {
  return `${annee}-01-01`;
}

/** Dernier jour de l'année donnée. */
export function finAnnee(annee: number): string {
  return `${annee}-12-31`;
}

/** Exercice comptable courant. */
export const ANNEE_COURANTE = new Date().getFullYear();

/** UUID syntaxiquement valide mais absent de la base. */
export const UUID_INEXISTANT = '00000000-0000-0000-0000-000000000000';

/** Chaîne qui n'est pas un UUID, pour tester le typage des paramètres. */
export const UUID_MALFORME = 'pas-un-uuid';

/** Décision maker-checker d'acceptation. */
export function decisionValide(
  checkerOperationType: 'CREATE' | 'UPDATE' | 'UPDATE_IMAGE' = 'CREATE',
) {
  return { decision: 'ACCEPTED' as const, notes: 'Validé par le test AQA', checkerOperationType };
}
