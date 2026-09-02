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

/** Corps valide de création d'un plan budgétaire. */
export function planBudgetaireValide(utilisateurId: string) {
  return {
    annee: ANNEE_COURANTE + 1,
    intitule: `Plan ${unique('PB')}`,
    utilisateurId,
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

/** Décision maker-checker d'acceptation. */
export function decisionValide(
  checkerOperationType: 'CREATE' | 'UPDATE' | 'UPDATE_IMAGE' = 'CREATE',
) {
  return { decision: 'ACCEPTED' as const, notes: 'Validé par le test AQA', checkerOperationType };
}
