import { isoDate, today, unique } from '../../test-data/builders';

/**
 * Constructeurs de corps propres au module Trésorerie : ils n'encodent que des
 * règles de ce module et ne servent à aucun autre.
 */

/** Corps valide d'une prévision de trésorerie. */
export function previsionValide(overrides: Record<string, unknown> = {}) {
  return {
    dateEcheance: isoDate(30),
    type: 'ENCAISSEMENT',
    source: 'MANUEL',
    libelle: `Prévision ${unique('PRV')}`,
    montant: 1_500_000,
    ...overrides,
  };
}

/** Corps valide d'un contrat de couverture de change. */
export function couvertureValide(overrides: Record<string, unknown> = {}) {
  return {
    reference: unique('CVT'),
    devise: 'EUR',
    montantDevise: 100_000,
    coursGaranti: 656.5,
    dateEffet: today(),
    dateEcheance: isoDate(180),
    ...overrides,
  };
}
