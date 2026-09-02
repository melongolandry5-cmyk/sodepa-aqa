import { ANNEE_COURANTE, unique } from '../../test-data/builders';

/** Constructeurs de corps propres au module Budget. */

/** Corps valide de création d'un plan budgétaire. */
export function planBudgetaireValide(utilisateurId: string) {
  return {
    annee: ANNEE_COURANTE + 1,
    intitule: `Plan ${unique('PB')}`,
    utilisateurId,
  };
}
