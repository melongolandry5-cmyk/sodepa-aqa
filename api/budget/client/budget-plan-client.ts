import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient, cleanParams } from '../../../helpers/base-api-client';
import { PageQuery, PageRecord } from '../../types/common';
import { BudgetItemOutput, BudgetPlanOutput, EngagementOutput } from '../../types/budget';
import { BUDGET_PATHS } from '../budget-api-paths';

/** Corps de création d'un plan budgétaire (CreerBudgetRequest). */
export interface CreerBudgetBody {
  annee?: number;
  intitule?: string;
  utilisateurId?: string;
}

/** Corps d'ajout d'un poste budgétaire (AjouterItemRequest). */
export interface AjouterItemBody {
  compteCode?: string;
  sectionId?: string;
  montant?: number;
}

/** Corps d'une réallocation (ReallocationRequest). */
export interface ReallocationBody {
  sourceItemId?: string;
  destItemId?: string;
  montant?: number;
  responsableId?: string;
  raison?: string;
}

/** Corps d'un engagement de dépense (EngagementRequest). */
export interface EngagementBody {
  planId?: string;
  compteCode?: string;
  sectionId?: string;
  numeroEngagement?: string;
  description?: string;
  montant?: number;
  utilisateurId?: string;
}

/** Client des endpoints /api/budget (plans et engagements). */
export class BudgetPlanClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async listerPlans(
    query: PageQuery & { annee?: number; statut?: string } = {},
  ): Promise<PageRecord<BudgetPlanOutput>> {
    const response = await this.get(BUDGET_PATHS.plans, { params: cleanParams(query) });
    return this.json<PageRecord<BudgetPlanOutput>>(response);
  }

  async listerPlansRaw(
    query: Record<string, string | number | boolean>,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.get(BUDGET_PATHS.plans, { params: query, expectStatus });
  }

  async getPlan(planId: string): Promise<BudgetPlanOutput> {
    const response = await this.get(BUDGET_PATHS.plan(planId));
    return this.json<BudgetPlanOutput>(response);
  }

  async getPlanRaw(planId: string, expectStatus?: number[]): Promise<APIResponse> {
    return this.get(BUDGET_PATHS.plan(planId), { expectStatus });
  }

  async listerEngagements(
    query: PageQuery & { planId?: string; statut?: string } = {},
  ): Promise<PageRecord<EngagementOutput>> {
    const response = await this.get(BUDGET_PATHS.engagements, { params: cleanParams(query) });
    return this.json<PageRecord<EngagementOutput>>(response);
  }

  async getEngagement(numero: string): Promise<EngagementOutput> {
    const response = await this.get(BUDGET_PATHS.engagement(numero));
    return this.json<EngagementOutput>(response);
  }

  async getEngagementRaw(numero: string, expectStatus?: number[]): Promise<APIResponse> {
    return this.get(BUDGET_PATHS.engagement(numero), { expectStatus });
  }

  async creerPlan(body: CreerBudgetBody): Promise<BudgetPlanOutput> {
    const response = await this.post(BUDGET_PATHS.plans, { data: body });
    return this.json<BudgetPlanOutput>(response);
  }

  async creerPlanRaw(body: CreerBudgetBody, expectStatus?: number[]): Promise<APIResponse> {
    return this.post(BUDGET_PATHS.plans, { data: body, expectStatus });
  }

  async ajouterItem(planId: string, body: AjouterItemBody): Promise<BudgetItemOutput> {
    const response = await this.post(BUDGET_PATHS.planItems(planId), { data: body });
    return this.json<BudgetItemOutput>(response);
  }

  async ajouterItemRaw(
    planId: string,
    body: AjouterItemBody,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.post(BUDGET_PATHS.planItems(planId), { data: body, expectStatus });
  }

  async soumettrePlan(planId: string, userId: string, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.planSoumettre(planId), { params: { userId }, expectStatus });
  }

  async approuverPlan(planId: string, userId: string, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.planApprouver(planId), { params: { userId }, expectStatus });
  }

  async rejeterPlan(planId: string, userId: string, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.planRejeter(planId), { params: { userId }, expectStatus });
  }

  async reallocer(body: ReallocationBody, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.reallocations, { data: body, expectStatus });
  }

  async engager(body: EngagementBody): Promise<EngagementOutput> {
    const response = await this.post(BUDGET_PATHS.engagements, { data: body });
    return this.json<EngagementOutput>(response);
  }

  async engagerRaw(body: EngagementBody, expectStatus?: number[]): Promise<APIResponse> {
    return this.post(BUDGET_PATHS.engagements, { data: body, expectStatus });
  }

  async liquider(numero: string, userId: string, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.engagementLiquider(numero), {
      params: { userId },
      expectStatus,
    });
  }

  async annuler(numero: string, userId: string, expectStatus?: number[]) {
    return this.post(BUDGET_PATHS.engagementAnnuler(numero), { params: { userId }, expectStatus });
  }
}
