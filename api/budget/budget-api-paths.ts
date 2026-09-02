import { EndpointDescriptor, UUID_ZERO } from '../types/endpoint';

const BASE = '/api/budget';
const BASE_COLLABORATIF = `${BASE}/collaboratif`;
const BASE_WORKFLOW = `${BASE}/engagements/workflow`;

/** Chemins du module Budget : plans, engagements, collaboratif, workflow. */
export const BUDGET_PATHS = {
  base: BASE,
  plans: `${BASE}/plans`,
  plan: (planId: string) => `${BASE}/plans/${planId}`,
  planItems: (planId: string) => `${BASE}/plans/${planId}/items`,
  planSoumettre: (planId: string) => `${BASE}/plans/${planId}/soumettre`,
  planApprouver: (planId: string) => `${BASE}/plans/${planId}/approuver`,
  planRejeter: (planId: string) => `${BASE}/plans/${planId}/rejeter`,
  reallocations: `${BASE}/reallocations`,
  engagements: `${BASE}/engagements`,
  engagement: (numero: string) => `${BASE}/engagements/${encodeURIComponent(numero)}`,
  engagementLiquider: (numero: string) =>
    `${BASE}/engagements/${encodeURIComponent(numero)}/liquider`,
  engagementAnnuler: (numero: string) =>
    `${BASE}/engagements/${encodeURIComponent(numero)}/annuler`,

  collaboratifBase: BASE_COLLABORATIF,
  demandes: `${BASE_COLLABORATIF}/demandes`,
  demandesSoumettre: `${BASE_COLLABORATIF}/demandes/soumettre`,
  demandeApprouver: (demandeId: string) =>
    `${BASE_COLLABORATIF}/demandes/${demandeId}/approuver`,
  demandeRejeter: (demandeId: string) => `${BASE_COLLABORATIF}/demandes/${demandeId}/rejeter`,
  cadrage: `${BASE_COLLABORATIF}/cadrage`,
  generer: `${BASE_COLLABORATIF}/generer`,
  consolider: `${BASE_COLLABORATIF}/consolider`,

  workflowBase: BASE_WORKFLOW,
  preEngager: `${BASE_WORKFLOW}/pre-engager`,
  workflowValider: `${BASE_WORKFLOW}/valider`,
  workflowRejeter: `${BASE_WORKFLOW}/rejeter`,
} as const;

export const BUDGET_ENDPOINTS: EndpointDescriptor[] = [
  // Plans et engagements
  { method: 'get', path: BUDGET_PATHS.plans, domain: 'budget' },
  { method: 'get', path: BUDGET_PATHS.plan(UUID_ZERO), domain: 'budget' },
  { method: 'get', path: BUDGET_PATHS.engagements, domain: 'budget' },
  { method: 'get', path: BUDGET_PATHS.engagement('INEXISTANT'), domain: 'budget' },
  {
    method: 'post',
    path: BUDGET_PATHS.plans,
    domain: 'budget',
    sampleBody: { annee: 2030, intitule: 'x', utilisateurId: UUID_ZERO },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.planItems(UUID_ZERO),
    domain: 'budget',
    sampleBody: { compteCode: '605200', montant: 1 },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.planSoumettre(UUID_ZERO),
    domain: 'budget',
    sampleParams: { userId: UUID_ZERO },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.planApprouver(UUID_ZERO),
    domain: 'budget',
    sampleParams: { userId: UUID_ZERO },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.planRejeter(UUID_ZERO),
    domain: 'budget',
    sampleParams: { userId: UUID_ZERO },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.reallocations,
    domain: 'budget',
    sampleBody: {
      sourceItemId: UUID_ZERO,
      destItemId: UUID_ZERO,
      montant: 1,
      responsableId: UUID_ZERO,
      raison: 'x',
    },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.engagements,
    domain: 'budget',
    sampleBody: {
      planId: UUID_ZERO,
      compteCode: '605200',
      numeroEngagement: 'x',
      description: 'x',
      montant: 1,
      utilisateurId: UUID_ZERO,
    },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.engagementLiquider('X'),
    domain: 'budget',
    sampleParams: { userId: UUID_ZERO },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.engagementAnnuler('X'),
    domain: 'budget',
    sampleParams: { userId: UUID_ZERO },
  },

  // Budget collaboratif
  { method: 'get', path: BUDGET_PATHS.demandes, domain: 'budget-collaboratif' },
  {
    method: 'post',
    path: BUDGET_PATHS.demandes,
    domain: 'budget-collaboratif',
    sampleBody: { departementId: UUID_ZERO, annee: 2030, compteCode: '605200', montant: 1 },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.demandesSoumettre,
    domain: 'budget-collaboratif',
    sampleParams: { departementId: UUID_ZERO, annee: 2030 },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.demandeApprouver(UUID_ZERO),
    domain: 'budget-collaboratif',
    sampleParams: { userId: UUID_ZERO },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.demandeRejeter(UUID_ZERO),
    domain: 'budget-collaboratif',
    sampleParams: { motif: 'x', userId: UUID_ZERO },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.cadrage,
    domain: 'budget-collaboratif',
    sampleBody: { annee: 2030, comptePrefix: '6', coefficient: 1, responsableId: UUID_ZERO },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.generer,
    domain: 'budget-collaboratif',
    sampleBody: {
      anneeSource: 2029,
      anneeCible: 2030,
      coeffVentes: 1,
      coeffCharges: 1,
      departementId: UUID_ZERO,
    },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.consolider,
    domain: 'budget-collaboratif',
    sampleParams: { annee: 2030, planId: UUID_ZERO, userId: UUID_ZERO },
  },

  // Workflow d'engagement
  {
    method: 'post',
    path: BUDGET_PATHS.preEngager,
    domain: 'engagement-workflow',
    sampleBody: {
      planId: UUID_ZERO,
      compteCode: '605200',
      sectionId: UUID_ZERO,
      numeroEngagement: 'x',
      montant: 1,
      utilisateurId: UUID_ZERO,
    },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.workflowValider,
    domain: 'engagement-workflow',
    sampleBody: { numeroEngagement: 'x', roleApprobateur: 'DAF', utilisateurId: UUID_ZERO },
  },
  {
    method: 'post',
    path: BUDGET_PATHS.workflowRejeter,
    domain: 'engagement-workflow',
    sampleBody: { numeroEngagement: 'x', motif: 'x', utilisateurId: UUID_ZERO },
  },
];
