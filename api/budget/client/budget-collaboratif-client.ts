import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient, cleanParams } from '../../../helpers/base-api-client';
import { BUDGET_PATHS } from '../budget-api-paths';

/** Client des endpoints /api/budget/collaboratif. */
export class BudgetCollaboratifClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async listerDemandes(
    query: { departementId?: string; annee?: number; statut?: string } = {},
  ): Promise<Record<string, unknown>[]> {
    const response = await this.get(BUDGET_PATHS.demandes, { params: cleanParams(query) });
    return this.json<Record<string, unknown>[]>(response);
  }

  async listerDemandesRaw(expectStatus?: number[]): Promise<APIResponse> {
    return this.get(BUDGET_PATHS.demandes, { expectStatus });
  }

  async saisirDemande(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.demandes, { data: body, expectStatus });
  }

  async soumettreDemandes(departementId: string, annee: number, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.demandesSoumettre, {
      params: { departementId, annee },
      expectStatus,
    });
  }

  async approuverDemande(demandeId: string, userId: string, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.demandeApprouver(demandeId), {
      params: { userId },
      expectStatus,
    });
  }

  async rejeterDemande(
    demandeId: string,
    motif: string,
    userId: string,
    expectStatus?: number[],
  ) {
    return this.post(BUDGET_PATHS.demandeRejeter(demandeId), {
      params: { motif, userId },
      expectStatus,
    });
  }

  async appliquerCadrage(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.cadrage, { data: body, expectStatus });
  }

  async genererDepuisHistorique(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.generer, { data: body, expectStatus });
  }

  async consolider(annee: number, planId: string, userId: string, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.consolider, {
      params: { annee, planId, userId },
      expectStatus,
    });
  }
}

/** Client des endpoints /api/budget/engagements/workflow. */
export class EngagementWorkflowClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async preEngager(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.preEngager, { data: body, expectStatus });
  }

  async validerEtape(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.workflowValider, { data: body, expectStatus });
  }

  async rejeter(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.workflowRejeter, { data: body, expectStatus });
  }
}
