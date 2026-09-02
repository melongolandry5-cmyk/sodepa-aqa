import { DATE_ECHANTILLON, EndpointDescriptor, UUID_ZERO } from '../types/endpoint';

const BASE_BANK = '/api/v1/caccounting/bank';
const BASE_COMPTE = '/api/v1/caccounting/compte';
const BASE_TIERS = '/api/v1/caccounting/tiers';
const BASE_JOURNAL = '/api/comptabilite/journaux';
const BASE_ECRITURE = '/api/comptabilite/ecritures';
const BASE_IMMO = '/api/v1/immobilisations';
const BASE_CLOTURE = '/api/comptabilite/cloture';
const BASE_RAPPROCHEMENT = '/api/comptabilite/rapprochement';
const BASE_REPORTING = '/api/comptabilite/reporting';

/** Décision maker-checker d'exemple, réutilisée par les corps de sécurité. */
const DECISION = { decision: 'ACCEPTED', notes: 'x', checkerOperationType: 'CREATE' };

/** Chemins du module Comptabilité générale (référentiel, écritures, états). */
export const COMPTA_PATHS = {
  banqueBase: BASE_BANK,
  banqueInitCreate: `${BASE_BANK}/init_create`,
  banqueList: `${BASE_BANK}/list`,
  banque: (id: string) => `${BASE_BANK}/${id}`,
  banqueActive: (id: string) => `${BASE_BANK}/active_by_id/${id}`,
  banqueInitUpdate: (id: string) => `${BASE_BANK}/init_update/${id}`,
  banqueInitUpdateImage: (id: string) => `${BASE_BANK}/init_update_image/${id}`,
  banqueDecision: (id: string) => `${BASE_BANK}/validate_or_reject/${id}`,

  compteBase: BASE_COMPTE,
  compteInitCreate: `${BASE_COMPTE}/init_create`,
  compteList: `${BASE_COMPTE}/list`,
  compte: (id: string) => `${BASE_COMPTE}/${id}`,
  compteActive: (id: string) => `${BASE_COMPTE}/active_by_id/${id}`,
  compteInitUpdate: (id: string) => `${BASE_COMPTE}/init_update/${id}`,
  compteDecision: (id: string) => `${BASE_COMPTE}/validate_or_reject/${id}`,

  tiersBase: BASE_TIERS,
  tiersInitCreate: `${BASE_TIERS}/init_create`,
  tiersList: `${BASE_TIERS}/list`,
  tiers: (id: string) => `${BASE_TIERS}/${id}`,
  tiersActive: (id: string) => `${BASE_TIERS}/active_by_id/${id}`,
  tiersInitUpdate: (id: string) => `${BASE_TIERS}/init_update/${id}`,
  tiersDecision: (id: string) => `${BASE_TIERS}/validate_or_reject/${id}`,

  journalBase: BASE_JOURNAL,
  journalInitCreate: `${BASE_JOURNAL}/init_create`,
  journalList: `${BASE_JOURNAL}/list`,
  journal: (id: string) => `${BASE_JOURNAL}/${id}`,
  journalActive: (id: string) => `${BASE_JOURNAL}/active_by_id/${id}`,
  journalInitUpdate: (id: string) => `${BASE_JOURNAL}/init_update/${id}`,
  journalToggle: (id: string) => `${BASE_JOURNAL}/${id}/toggle`,
  journalDecision: (id: string) => `${BASE_JOURNAL}/validate_or_reject/${id}`,

  ecritureBase: BASE_ECRITURE,
  ecritureSimulerTva: `${BASE_ECRITURE}/simuler-tva`,
  ecriture: (id: string) => `${BASE_ECRITURE}/${id}`,
  ecritureSoumettre: (id: string) => `${BASE_ECRITURE}/${id}/soumettre`,
  ecritureValider: (id: string) => `${BASE_ECRITURE}/${id}/valider`,
  ecritureRejeter: (id: string) => `${BASE_ECRITURE}/${id}/rejeter`,

  immoBase: BASE_IMMO,
  immoPending: `${BASE_IMMO}/pending`,
  immo: (id: string) => `${BASE_IMMO}/${id}`,
  immoPlan: (id: string) => `${BASE_IMMO}/${id}/plan`,
  immoInitCreate: `${BASE_IMMO}/init_create`,
  immoInitUpdate: (id: string) => `${BASE_IMMO}/init_update/${id}`,
  immoInitAmortir: `${BASE_IMMO}/init_amortir`,
  immoDecision: (id: string) => `${BASE_IMMO}/validate_or_reject/${id}`,

  clotureExercice: (annee: number) => `${BASE_CLOTURE}/${annee}`,
  clotureReevaluer: `${BASE_CLOTURE}/reevaluer`,

  releves: `${BASE_RAPPROCHEMENT}/releves`,
  releve: (releveId: string) => `${BASE_RAPPROCHEMENT}/releves/${releveId}`,
  releveManuel: `${BASE_RAPPROCHEMENT}/manuel`,
  releveSynchroniser: `${BASE_RAPPROCHEMENT}/synchroniser`,
  releveRapprocher: (releveId: string) => `${BASE_RAPPROCHEMENT}/${releveId}/rapprocher`,

  reportingBase: BASE_REPORTING,
  livreJournal: `${BASE_REPORTING}/livre-journal`,
  grandLivre: `${BASE_REPORTING}/grand-livre`,
  balance: `${BASE_REPORTING}/balance`,
  bilan: `${BASE_REPORTING}/bilan`,
  compteResultat: `${BASE_REPORTING}/compte-resultat`,
  tft: `${BASE_REPORTING}/tft`,
  tva: `${BASE_REPORTING}/tva`,
  fec: `${BASE_REPORTING}/fec`,
} as const;

export const COMPTA_ENDPOINTS: EndpointDescriptor[] = [
  // Banques
  { method: 'post', path: COMPTA_PATHS.banqueInitCreate, domain: 'banque', multipart: true },
  { method: 'get', path: COMPTA_PATHS.banqueBase, domain: 'banque' },
  { method: 'get', path: COMPTA_PATHS.banqueList, domain: 'banque' },
  { method: 'get', path: COMPTA_PATHS.banque(UUID_ZERO), domain: 'banque' },
  { method: 'get', path: COMPTA_PATHS.banqueActive(UUID_ZERO), domain: 'banque' },
  {
    method: 'put',
    path: COMPTA_PATHS.banqueInitUpdate(UUID_ZERO),
    domain: 'banque',
    sampleBody: { code: 'X', name: 'x', accountingCode: '521', logo: 'x', status: true },
  },
  {
    method: 'put',
    path: COMPTA_PATHS.banqueInitUpdateImage(UUID_ZERO),
    domain: 'banque',
    multipart: true,
  },
  {
    method: 'put',
    path: COMPTA_PATHS.banqueDecision(UUID_ZERO),
    domain: 'banque',
    sampleBody: DECISION,
  },

  // Comptes
  {
    method: 'post',
    path: COMPTA_PATHS.compteInitCreate,
    domain: 'compte',
    sampleBody: { code: '999999', intitule: 'x', niveau: 1 },
  },
  { method: 'get', path: COMPTA_PATHS.compteBase, domain: 'compte' },
  { method: 'get', path: COMPTA_PATHS.compteList, domain: 'compte' },
  { method: 'get', path: COMPTA_PATHS.compte(UUID_ZERO), domain: 'compte' },
  { method: 'get', path: COMPTA_PATHS.compteActive(UUID_ZERO), domain: 'compte' },
  {
    method: 'put',
    path: COMPTA_PATHS.compteInitUpdate(UUID_ZERO),
    domain: 'compte',
    sampleBody: { code: '999999', intitule: 'x', niveau: 1 },
  },
  { method: 'delete', path: COMPTA_PATHS.compte(UUID_ZERO), domain: 'compte', destructive: true },
  {
    method: 'put',
    path: COMPTA_PATHS.compteDecision(UUID_ZERO),
    domain: 'compte',
    sampleBody: DECISION,
  },

  // Tiers
  {
    method: 'post',
    path: COMPTA_PATHS.tiersInitCreate,
    domain: 'tiers',
    sampleBody: { code: 'X', raisonSociale: 'x', typeTiers: 'CLIENT', compteCollectifCode: '411' },
  },
  { method: 'get', path: COMPTA_PATHS.tiersBase, domain: 'tiers' },
  { method: 'get', path: COMPTA_PATHS.tiersList, domain: 'tiers' },
  { method: 'get', path: COMPTA_PATHS.tiers(UUID_ZERO), domain: 'tiers' },
  { method: 'get', path: COMPTA_PATHS.tiersActive(UUID_ZERO), domain: 'tiers' },
  {
    method: 'put',
    path: COMPTA_PATHS.tiersInitUpdate(UUID_ZERO),
    domain: 'tiers',
    sampleBody: {
      code: 'X',
      raisonSociale: 'x',
      typeTiers: 'CLIENT',
      compteCollectifCode: '411',
      actif: true,
    },
  },
  {
    method: 'put',
    path: COMPTA_PATHS.tiersDecision(UUID_ZERO),
    domain: 'tiers',
    sampleBody: DECISION,
  },

  // Journaux
  {
    method: 'post',
    path: COMPTA_PATHS.journalInitCreate,
    domain: 'journal',
    sampleBody: { code: 'OD', intitule: 'x', typeJournal: 'DIVERS' },
  },
  { method: 'get', path: COMPTA_PATHS.journalBase, domain: 'journal' },
  { method: 'get', path: COMPTA_PATHS.journalList, domain: 'journal' },
  { method: 'get', path: COMPTA_PATHS.journal(UUID_ZERO), domain: 'journal' },
  { method: 'get', path: COMPTA_PATHS.journalActive(UUID_ZERO), domain: 'journal' },
  {
    method: 'put',
    path: COMPTA_PATHS.journalInitUpdate(UUID_ZERO),
    domain: 'journal',
    sampleBody: { code: 'OD', intitule: 'x', typeJournal: 'DIVERS', actif: true },
  },
  {
    method: 'put',
    path: COMPTA_PATHS.journalToggle(UUID_ZERO),
    domain: 'journal',
    destructive: true,
  },
  {
    method: 'put',
    path: COMPTA_PATHS.journalDecision(UUID_ZERO),
    domain: 'journal',
    sampleBody: DECISION,
  },

  // Écritures
  {
    method: 'post',
    path: COMPTA_PATHS.ecritureBase,
    domain: 'ecriture',
    sampleBody: {
      journalId: UUID_ZERO,
      numeroPiece: 'x',
      libelle: 'x',
      dateComptable: DATE_ECHANTILLON,
      lignes: [{ compteCode: '601', debit: 1 }],
    },
  },
  {
    method: 'post',
    path: COMPTA_PATHS.ecritureSimulerTva,
    domain: 'ecriture',
    sampleBody: { montantHt: 100, tauxTva: 19.25, compteHtCode: '601' },
  },
  { method: 'post', path: COMPTA_PATHS.ecritureSoumettre(UUID_ZERO), domain: 'ecriture' },
  { method: 'post', path: COMPTA_PATHS.ecritureValider(UUID_ZERO), domain: 'ecriture' },
  { method: 'post', path: COMPTA_PATHS.ecritureRejeter(UUID_ZERO), domain: 'ecriture' },
  { method: 'get', path: COMPTA_PATHS.ecriture(UUID_ZERO), domain: 'ecriture' },

  // Immobilisations
  { method: 'get', path: COMPTA_PATHS.immoBase, domain: 'immobilisation' },
  { method: 'get', path: COMPTA_PATHS.immoPending, domain: 'immobilisation' },
  { method: 'get', path: COMPTA_PATHS.immo(UUID_ZERO), domain: 'immobilisation' },
  { method: 'get', path: COMPTA_PATHS.immoPlan(UUID_ZERO), domain: 'immobilisation' },
  {
    method: 'post',
    path: COMPTA_PATHS.immoInitCreate,
    domain: 'immobilisation',
    sampleBody: {
      code: 'X',
      designation: 'x',
      valeurOrigine: 1,
      dateAcquisition: DATE_ECHANTILLON,
      dateMiseEnService: DATE_ECHANTILLON,
      modeAmortissement: 'LINEAIRE',
      dureeUtile: 5,
    },
  },
  {
    method: 'put',
    path: COMPTA_PATHS.immoInitUpdate(UUID_ZERO),
    domain: 'immobilisation',
    sampleBody: {
      code: 'X',
      designation: 'x',
      valeurOrigine: 1,
      dateAcquisition: DATE_ECHANTILLON,
      dateMiseEnService: DATE_ECHANTILLON,
      modeAmortissement: 'LINEAIRE',
      dureeUtile: 5,
      statut: 'ACTIVE',
    },
  },
  {
    method: 'post',
    path: COMPTA_PATHS.immoInitAmortir,
    domain: 'immobilisation',
    sampleBody: { annee: 2025, compteImmoCode: '241' },
  },
  {
    method: 'put',
    path: COMPTA_PATHS.immoDecision(UUID_ZERO),
    domain: 'immobilisation',
    sampleBody: DECISION,
  },

  // Clôture
  { method: 'post', path: COMPTA_PATHS.clotureExercice(2025), domain: 'cloture', destructive: true },
  {
    method: 'post',
    path: COMPTA_PATHS.clotureReevaluer,
    domain: 'cloture',
    destructive: true,
    sampleBody: { annee: 2025, coursCloture: { EUR: 655.957 } },
  },

  // Relevés bancaires
  { method: 'get', path: COMPTA_PATHS.releves, domain: 'rapprochement' },
  { method: 'get', path: COMPTA_PATHS.releve(UUID_ZERO), domain: 'rapprochement' },
  {
    method: 'post',
    path: COMPTA_PATHS.releveManuel,
    domain: 'rapprochement',
    sampleBody: {
      banqueId: UUID_ZERO,
      dateReleve: DATE_ECHANTILLON,
      soldeInitial: 0,
      soldeFinal: 0,
      lignes: [{ dateTransaction: DATE_ECHANTILLON, libelle: 'x', montant: 1 }],
    },
  },
  {
    method: 'post',
    path: COMPTA_PATHS.releveSynchroniser,
    domain: 'rapprochement',
    sampleBody: { banqueId: UUID_ZERO, dateReleve: DATE_ECHANTILLON, soldeInitial: 0 },
  },
  {
    method: 'post',
    path: COMPTA_PATHS.releveRapprocher(UUID_ZERO),
    domain: 'rapprochement',
    sampleParams: { compteBanqueCode: '521' },
  },

  // Reporting OHADA
  {
    method: 'get',
    path: COMPTA_PATHS.livreJournal,
    domain: 'reporting',
    sampleParams: { debut: DATE_ECHANTILLON, fin: DATE_ECHANTILLON },
  },
  {
    method: 'get',
    path: COMPTA_PATHS.grandLivre,
    domain: 'reporting',
    sampleParams: { debut: DATE_ECHANTILLON, fin: DATE_ECHANTILLON },
  },
  {
    method: 'get',
    path: COMPTA_PATHS.balance,
    domain: 'reporting',
    sampleParams: { debut: DATE_ECHANTILLON, fin: DATE_ECHANTILLON },
  },
  {
    method: 'get',
    path: COMPTA_PATHS.bilan,
    domain: 'reporting',
    sampleParams: { dateBilan: DATE_ECHANTILLON },
  },
  {
    method: 'get',
    path: COMPTA_PATHS.compteResultat,
    domain: 'reporting',
    sampleParams: { annee: 2025 },
  },
  { method: 'get', path: COMPTA_PATHS.tft, domain: 'reporting', sampleParams: { annee: 2025 } },
  {
    method: 'get',
    path: COMPTA_PATHS.tva,
    domain: 'reporting',
    sampleParams: { annee: 2025, mois: 1 },
  },
  { method: 'get', path: COMPTA_PATHS.fec, domain: 'reporting', sampleParams: { annee: 2025 } },
];
