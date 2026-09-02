import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient, cleanParams } from '../../../helpers/base-api-client';
import { PageQuery, PageRecord } from '../../types/common';
import {
  EcheanceOutput,
  FinancementOutput,
  FinancementSmartOutput,
  SimulationQuery,
} from '../../types/financement';
import { FINANCEMENT_PATHS } from '../financement-api-paths';

/** Corps de création d'un financement (CreerFinancementRequest). */
export interface CreerFinancementBody {
  banqueId?: string;
  intitule?: string;
  type?: string;
  capital?: number;
  tauxNominal?: number;
  dateEffet?: string;
  dureeMois?: number;
  periodicite?: string;
  utilisateurId?: string;
}

/** Corps de création d'un engagement hors-bilan (CreerHorsBilanRequest). */
export interface CreerHorsBilanBody {
  type?: string;
  intitule?: string;
  tiersId?: string;
  montant?: number;
  dateEffet?: string;
  dateEcheance?: string;
}

/** Client des endpoints /api/financement. */
export class FinancementClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  /** Recherche paginée, filtrable par prêteur et par nature. */
  async lister(
    query: PageQuery & { banqueId?: string; type?: string } = {},
  ): Promise<PageRecord<FinancementSmartOutput>> {
    const response = await this.get(FINANCEMENT_PATHS.base, { params: cleanParams(query) });
    return this.json<PageRecord<FinancementSmartOutput>>(response);
  }

  async listerRaw(
    query: Record<string, string | number | boolean>,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.get(FINANCEMENT_PATHS.base, { params: query, expectStatus });
  }

  /** Consultation unitaire avec échéancier. */
  async getById(id: string): Promise<FinancementOutput> {
    const response = await this.get(FINANCEMENT_PATHS.byId(id));
    return this.json<FinancementOutput>(response);
  }

  /** Consultation unitaire sans assertion de statut (cas 404 / id invalide). */
  async getByIdRaw(id: string, expectStatus: number[]): Promise<APIResponse> {
    return this.get(FINANCEMENT_PATHS.byId(id), { expectStatus });
  }

  /** Enregistrement d'un financement, plan d'amortissement inclus. */
  async creer(body: CreerFinancementBody): Promise<FinancementOutput> {
    const response = await this.post(FINANCEMENT_PATHS.base, { data: body });
    return this.json<FinancementOutput>(response);
  }

  async creerRaw(body: CreerFinancementBody, expectStatus?: number[]): Promise<APIResponse> {
    return this.post(FINANCEMENT_PATHS.base, { data: body, expectStatus });
  }

  /** Simulation d'un plan d'amortissement, sans persistance. */
  async simuler(query: SimulationQuery): Promise<EcheanceOutput[]> {
    const response = await this.get(FINANCEMENT_PATHS.simuler, { params: cleanParams(query) });
    return this.json<EcheanceOutput[]>(response);
  }

  async simulerRaw(
    query: Record<string, string | number | boolean>,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.get(FINANCEMENT_PATHS.simuler, { params: query, expectStatus });
  }

  /** Règlement d'une échéance. */
  async payerEcheance(echeanceId: string, userId: string, expectStatus?: number[]) {
    return this.post(FINANCEMENT_PATHS.payerEcheance(echeanceId), {
      params: { userId },
      expectStatus,
    });
  }

  async creerHorsBilan(body: CreerHorsBilanBody): Promise<unknown> {
    const response = await this.post(FINANCEMENT_PATHS.horsBilan, { data: body });
    return this.json<unknown>(response);
  }

  async creerHorsBilanRaw(body: CreerHorsBilanBody, expectStatus?: number[]): Promise<APIResponse> {
    return this.post(FINANCEMENT_PATHS.horsBilan, { data: body, expectStatus });
  }

  async reportingHorsBilan(): Promise<Record<string, unknown>[]> {
    const response = await this.get(FINANCEMENT_PATHS.reportingHorsBilan);
    return this.json<Record<string, unknown>[]>(response);
  }

  async reportingHorsBilanRaw(expectStatus?: number[]): Promise<APIResponse> {
    return this.get(FINANCEMENT_PATHS.reportingHorsBilan, { expectStatus });
  }

  async kpis(): Promise<Record<string, unknown>> {
    const response = await this.get(FINANCEMENT_PATHS.reportingKpis);
    return this.json<Record<string, unknown>>(response);
  }
}
