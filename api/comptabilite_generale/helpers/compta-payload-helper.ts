import { isoDate, today, unique } from '../../../test-data/builders';

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
/** Corps valide de création d'un compte général. */
export function compteValide(overrides: Record<string, unknown> = {}) {
  return {
    code: `9${Date.now().toString().slice(-5)}`,
    intitule: `Compte ${unique('CPT')}`,
    niveau: 3,
    nature: 'CHARGE',
    isAuxiliaire: false,
    ...overrides,
  };
}

/** Corps valide de création d'un tiers. */
export function tiersValide(overrides: Record<string, unknown> = {}) {
  return {
    code: unique('TRS'),
    raisonSociale: `Tiers ${unique('')}`,
    adresse: 'Douala',
    telephone: '690000000',
    email: 'tiers.aqa@example.com',
    typeTiers: 'CLIENT',
    compteCollectifCode: '411',
    ...overrides,
  };
}

/** Corps valide de création d'une immobilisation. */
export function immobilisationValide(overrides: Record<string, unknown> = {}) {
  return {
    code: unique('IMM'),
    designation: `Immobilisation ${unique('')}`,
    valeurOrigine: 5_000_000,
    dateAcquisition: isoDate(-60),
    dateMiseEnService: isoDate(-30),
    modeAmortissement: 'LINEAIRE',
    dureeUtile: 5,
    valeurResiduelle: 0,
    ...overrides,
  };
}
