import { DATE_ECHANTILLON, EndpointDescriptor, UUID_ZERO } from '../types/endpoint';

const BASE = '/api/financement';

/** Chemins du module Financement : emprunts, échéanciers, hors-bilan. */
export const FINANCEMENT_PATHS = {
  base: BASE,
  byId: (id: string) => `${BASE}/${id}`,
  simuler: `${BASE}/simuler`,
  payerEcheance: (echeanceId: string) => `${BASE}/echeances/${echeanceId}/payer`,
  horsBilan: `${BASE}/hors-bilan`,
  reportingHorsBilan: `${BASE}/reporting/hors-bilan`,
  reportingKpis: `${BASE}/reporting/kpis`,
} as const;

export const FINANCEMENT_ENDPOINTS: EndpointDescriptor[] = [
  { method: 'get', path: FINANCEMENT_PATHS.base, domain: 'financement' },
  { method: 'get', path: FINANCEMENT_PATHS.byId(UUID_ZERO), domain: 'financement' },
  {
    method: 'post',
    path: FINANCEMENT_PATHS.base,
    domain: 'financement',
    sampleBody: {
      banqueId: UUID_ZERO,
      intitule: 'x',
      type: 'PRET',
      capital: 1,
      tauxNominal: 1,
      dateEffet: DATE_ECHANTILLON,
      dureeMois: 12,
      periodicite: 'MENSUELLE',
      utilisateurId: UUID_ZERO,
    },
  },
  {
    method: 'get',
    path: FINANCEMENT_PATHS.simuler,
    domain: 'financement',
    sampleParams: {
      capital: 1000,
      tauxNominal: 5,
      dureeMois: 12,
      periodicite: 'MENSUELLE',
      dateEffet: DATE_ECHANTILLON,
    },
  },
  {
    method: 'post',
    path: FINANCEMENT_PATHS.payerEcheance(UUID_ZERO),
    domain: 'financement',
    sampleParams: { userId: UUID_ZERO },
  },
  {
    method: 'post',
    path: FINANCEMENT_PATHS.horsBilan,
    domain: 'financement',
    sampleBody: {
      type: 'CAUTION',
      intitule: 'x',
      tiersId: UUID_ZERO,
      montant: 1,
      dateEffet: DATE_ECHANTILLON,
      dateEcheance: DATE_ECHANTILLON,
    },
  },
  { method: 'get', path: FINANCEMENT_PATHS.reportingHorsBilan, domain: 'financement' },
  { method: 'get', path: FINANCEMENT_PATHS.reportingKpis, domain: 'financement' },
];
