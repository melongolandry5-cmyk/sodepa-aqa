import { today, unique } from '../../../test-data/builders';

/**
 * Constructeurs de corps propres au module Comptabilité générale.
 *
 * Ils vivent ici plutôt que dans `test-data/` parce qu'ils encodent des règles
 * métier du module — l'équilibre débit/crédit d'une écriture, la structure d'un
 * relevé bancaire — et ne servent à aucun autre module.
 */

/** Écriture équilibrée à 100 000 XAF, dérivable via `overrides`. */
export function ecritureEquilibree(journalId: string, overrides: Record<string, unknown> = {}) {
  return {
    journalId,
    numeroPiece: unique('PC'),
    libelle: `Écriture ${unique()}`,
    dateComptable: today(),
    lignes: [
      { compteCode: '601100', debit: 100_000, credit: 0, libelleLigne: 'Achat' },
      { compteCode: '401100', debit: 0, credit: 100_000, libelleLigne: 'Fournisseur' },
    ],
    ...overrides,
  };
}

/** Relevé bancaire manuel à deux lignes, dérivable via `overrides`. */
export function releveManuel(banqueId: string, overrides: Record<string, unknown> = {}) {
  return {
    banqueId,
    dateReleve: today(),
    soldeInitial: 1_000_000,
    soldeFinal: 1_250_000,
    lignes: [
      { dateTransaction: today(), libelle: 'Virement client', montant: 300_000 },
      { dateTransaction: today(), libelle: 'Frais bancaires', montant: -50_000 },
    ],
    ...overrides,
  };
}
