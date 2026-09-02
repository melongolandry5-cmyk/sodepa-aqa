import { DATE_ECHANTILLON, EndpointDescriptor, UUID_ZERO } from '../types/endpoint';

const BASE = '/api/tresorerie';
const BASE_CHANGE = `${BASE}/change`;
const BASE_RAPPROCHEMENT = `${BASE}/rapprochement`;
const BASE_PILOTAGE = '/api/reporting';

/** Chemins du module Trésorerie : prévisions, change, arbitrage, pilotage. */
export const TRESORERIE_PATHS = {
  base: BASE,
  previsions: `${BASE}/previsions`,
  cashFlow: `${BASE}/cash-flow`,
  bfr: `${BASE}/bfr`,
  alertesDecouvert: `${BASE}/decouverts/alertes`,
  whatIf: `${BASE}/simulations/what-if`,

  changeBase: BASE_CHANGE,
  couvertures: `${BASE_CHANGE}/couverture`,
  couvertureEvaluer: (id: string) => `${BASE_CHANGE}/couverture/${id}/evaluer`,

  rapprochementBase: BASE_RAPPROCHEMENT,
  matching: `${BASE_RAPPROCHEMENT}/matching`,
  arbitrage: `${BASE_RAPPROCHEMENT}/arbitrage`,

  pilotageBase: BASE_PILOTAGE,
  tft: `${BASE_PILOTAGE}/tft`,
  runway: `${BASE_PILOTAGE}/runway`,
} as const;

export const TRESORERIE_ENDPOINTS: EndpointDescriptor[] = [
  {
    method: 'get',
    path: TRESORERIE_PATHS.previsions,
    domain: 'tresorerie',
    sampleParams: { debut: DATE_ECHANTILLON, fin: DATE_ECHANTILLON },
  },
  {
    method: 'post',
    path: TRESORERIE_PATHS.previsions,
    domain: 'tresorerie',
    sampleBody: {
      dateEcheance: DATE_ECHANTILLON,
      type: 'ENCAISSEMENT',
      source: 'MANUEL',
      libelle: 'x',
      montant: 1,
    },
  },
  {
    method: 'get',
    path: TRESORERIE_PATHS.cashFlow,
    domain: 'tresorerie',
    sampleParams: { debut: DATE_ECHANTILLON, fin: DATE_ECHANTILLON },
  },
  {
    method: 'get',
    path: TRESORERIE_PATHS.bfr,
    domain: 'tresorerie',
    sampleParams: { date: DATE_ECHANTILLON },
  },
  { method: 'get', path: TRESORERIE_PATHS.alertesDecouvert, domain: 'tresorerie' },
  {
    method: 'get',
    path: TRESORERIE_PATHS.whatIf,
    domain: 'tresorerie',
    sampleParams: { croissance: 1, inflation: 1, prixRevient: 1 },
  },

  { method: 'get', path: TRESORERIE_PATHS.couvertures, domain: 'tresorerie-change' },
  {
    method: 'post',
    path: TRESORERIE_PATHS.couvertures,
    domain: 'tresorerie-change',
    sampleBody: {
      reference: 'x',
      devise: 'EUR',
      montantDevise: 1,
      coursGaranti: 1,
      dateEffet: DATE_ECHANTILLON,
      dateEcheance: DATE_ECHANTILLON,
    },
  },
  {
    method: 'get',
    path: TRESORERIE_PATHS.couvertureEvaluer(UUID_ZERO),
    domain: 'tresorerie-change',
    sampleParams: { coursSpot: 655 },
  },

  {
    method: 'post',
    path: TRESORERIE_PATHS.matching,
    domain: 'tresorerie-rapprochement',
    sampleParams: { releveId: UUID_ZERO },
  },
  {
    method: 'get',
    path: TRESORERIE_PATHS.arbitrage,
    domain: 'tresorerie-rapprochement',
    sampleParams: {
      fondsSecurite: 1,
      debut: DATE_ECHANTILLON,
      fin: DATE_ECHANTILLON,
      soldeActuel: 1,
    },
  },

  {
    method: 'get',
    path: TRESORERIE_PATHS.tft,
    domain: 'pilotage',
    sampleParams: { annee: 2025 },
  },
  { method: 'get', path: TRESORERIE_PATHS.runway, domain: 'pilotage' },
];
