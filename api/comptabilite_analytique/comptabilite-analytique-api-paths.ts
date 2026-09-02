import { DATE_ECHANTILLON, EndpointDescriptor, UUID_ZERO } from '../types/endpoint';

const BASE = '/api/comptabilite/analytique';
const BASE_BUDGETS = `${BASE}/budgets`;
const BASE_CLES = `${BASE}/cles`;
const BASE_REPORTING = `${BASE}/reporting`;

/** Chemins du module Comptabilité analytique. */
export const ANALYTIQUE_PATHS = {
  base: BASE,
  axes: `${BASE}/axes`,
  axeStatut: (id: string) => `${BASE}/axes/${id}/statut`,
  axeSections: (axeId: string) => `${BASE}/axes/${axeId}/sections`,
  sectionStatut: (id: string) => `${BASE}/sections/${id}/statut`,
  ventiler: (ligneId: string) => `${BASE}/lignes/${ligneId}/ventiler`,

  budgetsBase: BASE_BUDGETS,
  budgetsAnnee: (annee: number) => `${BASE_BUDGETS}/${annee}`,
  budgetsSection: (annee: number, sectionId: string) =>
    `${BASE_BUDGETS}/${annee}/sections/${sectionId}`,

  clesBase: BASE_CLES,
  appliquerCle: (ligneId: string, cleId: string) =>
    `${BASE_CLES}/lignes/${ligneId}/appliquer/${cleId}`,

  reportingBase: BASE_REPORTING,
  grandLivre: `${BASE_REPORTING}/grand-livre`,
  balance: `${BASE_REPORTING}/balance`,
  sectionResultat: (sectionId: string, annee: number) =>
    `${BASE_REPORTING}/sections/${sectionId}/resultat/${annee}`,
  sectionSuiviBudgetaire: (sectionId: string, annee: number) =>
    `${BASE_REPORTING}/sections/${sectionId}/suivi-budgetaire/${annee}`,
} as const;

export const ANALYTIQUE_ENDPOINTS: EndpointDescriptor[] = [
  {
    method: 'post',
    path: ANALYTIQUE_PATHS.axes,
    domain: 'analytique',
    sampleBody: { code: 'X', intitule: 'x' },
  },
  { method: 'get', path: ANALYTIQUE_PATHS.axes, domain: 'analytique' },
  {
    method: 'put',
    path: ANALYTIQUE_PATHS.axeStatut(UUID_ZERO),
    domain: 'analytique',
    sampleParams: { actif: true },
  },
  {
    method: 'post',
    path: ANALYTIQUE_PATHS.axeSections(UUID_ZERO),
    domain: 'analytique',
    sampleBody: { code: 'X', intitule: 'x' },
  },
  { method: 'get', path: ANALYTIQUE_PATHS.axeSections(UUID_ZERO), domain: 'analytique' },
  {
    method: 'put',
    path: ANALYTIQUE_PATHS.sectionStatut(UUID_ZERO),
    domain: 'analytique',
    sampleParams: { actif: true },
  },
  {
    method: 'post',
    path: ANALYTIQUE_PATHS.ventiler(UUID_ZERO),
    domain: 'analytique',
    sampleBody: [{ sectionId: UUID_ZERO, pourcentage: 100 }],
  },

  {
    method: 'post',
    path: ANALYTIQUE_PATHS.budgetsBase,
    domain: 'analytique-budget',
    sampleBody: {
      annee: 2030,
      sectionId: UUID_ZERO,
      compteCode: '605200',
      montantBudget: 1,
    },
  },
  { method: 'get', path: ANALYTIQUE_PATHS.budgetsAnnee(2030), domain: 'analytique-budget' },
  {
    method: 'get',
    path: ANALYTIQUE_PATHS.budgetsSection(2030, UUID_ZERO),
    domain: 'analytique-budget',
  },

  {
    method: 'post',
    path: ANALYTIQUE_PATHS.clesBase,
    domain: 'analytique-cles',
    sampleBody: { code: 'X', intitule: 'x', details: [] },
  },
  { method: 'get', path: ANALYTIQUE_PATHS.clesBase, domain: 'analytique-cles' },
  {
    method: 'post',
    path: ANALYTIQUE_PATHS.appliquerCle(UUID_ZERO, UUID_ZERO),
    domain: 'analytique-cles',
  },

  {
    method: 'get',
    path: ANALYTIQUE_PATHS.grandLivre,
    domain: 'analytique-reporting',
    sampleParams: { debut: DATE_ECHANTILLON, fin: DATE_ECHANTILLON },
  },
  {
    method: 'get',
    path: ANALYTIQUE_PATHS.balance,
    domain: 'analytique-reporting',
    sampleParams: { debut: DATE_ECHANTILLON, fin: DATE_ECHANTILLON },
  },
  {
    method: 'get',
    path: ANALYTIQUE_PATHS.sectionResultat(UUID_ZERO, 2025),
    domain: 'analytique-reporting',
  },
  {
    method: 'get',
    path: ANALYTIQUE_PATHS.sectionSuiviBudgetaire(UUID_ZERO, 2025),
    domain: 'analytique-reporting',
  },
];
