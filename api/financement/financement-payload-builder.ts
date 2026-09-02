import { today } from '../../test-data/builders';

/** Constructeurs de corps propres au module Financement. */

/** Jeu de paramètres valide pour la simulation d'un plan d'amortissement. */
export function simulationValide(
  overrides: Partial<{
    capital: number;
    tauxNominal: number;
    dureeMois: number;
    periodicite: string;
    dateEffet: string;
  }> = {},
) {
  return {
    capital: 10_000_000,
    tauxNominal: 7.5,
    dureeMois: 24,
    periodicite: 'MENSUELLE',
    dateEffet: today(),
    ...overrides,
  };
}
