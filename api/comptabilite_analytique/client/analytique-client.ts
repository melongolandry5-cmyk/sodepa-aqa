import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient } from '../../../helpers/base-api-client';
import { ANALYTIQUE_PATHS } from '../comptabilite-analytique-api-paths';

/** Client des axes, sections et ventilations analytiques. */
export class AnalytiqueClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async creerAxe(body: { code?: string; intitule?: string }, expectStatus?: number[]) {
    return this.post(ANALYTIQUE_PATHS.axes, { data: body, expectStatus });
  }

  async listerAxes(): Promise<Record<string, unknown>[]> {
    const response = await this.get(ANALYTIQUE_PATHS.axes);
    return this.json<Record<string, unknown>[]>(response);
  }

  async listerAxesRaw(expectStatus?: number[]): Promise<APIResponse> {
    return this.get(ANALYTIQUE_PATHS.axes, { expectStatus });
  }

  async modifierStatutAxe(id: string, actif: boolean, expectStatus?: number[]) {
    return this.put(ANALYTIQUE_PATHS.axeStatut(id), { params: { actif }, expectStatus });
  }

  async modifierStatutAxeSansParametre(id: string, expectStatus?: number[]) {
    return this.put(ANALYTIQUE_PATHS.axeStatut(id), { expectStatus });
  }

  async creerSection(
    axeId: string,
    body: { code?: string; intitule?: string },
    expectStatus?: number[],
  ) {
    return this.post(ANALYTIQUE_PATHS.axeSections(axeId), { data: body, expectStatus });
  }

  async listerSections(axeId: string, expectStatus?: number[]) {
    return this.get(ANALYTIQUE_PATHS.axeSections(axeId), { expectStatus });
  }

  async modifierStatutSection(id: string, actif: boolean, expectStatus?: number[]) {
    return this.put(ANALYTIQUE_PATHS.sectionStatut(id), { params: { actif }, expectStatus });
  }

  async ventilerLigne(
    ligneId: string,
    ventilations: { sectionId?: string; pourcentage?: number }[],
    expectStatus?: number[],
  ) {
    return this.post(ANALYTIQUE_PATHS.ventiler(ligneId), {
      data: ventilations,
      expectStatus,
    });
  }
}

/** Client des budgets analytiques par section. */
export class AnalytiqueBudgetClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async definirBudget(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(ANALYTIQUE_PATHS.budgetsBase, { data: body, expectStatus });
  }

  async listerParAnnee(annee: number): Promise<Record<string, unknown>[]> {
    const response = await this.get(ANALYTIQUE_PATHS.budgetsAnnee(annee));
    return this.json<Record<string, unknown>[]>(response);
  }

  async listerParAnneeRaw(annee: number, expectStatus?: number[]): Promise<APIResponse> {
    return this.get(ANALYTIQUE_PATHS.budgetsAnnee(annee), { expectStatus });
  }

  async listerParSection(annee: number, sectionId: string, expectStatus?: number[]) {
    return this.get(ANALYTIQUE_PATHS.budgetsSection(annee, sectionId), { expectStatus });
  }
}

/** Client des clés de répartition analytique. */
export class CleRepartitionClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async creerCle(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(ANALYTIQUE_PATHS.clesBase, { data: body, expectStatus });
  }

  async listerCles(): Promise<Record<string, unknown>[]> {
    const response = await this.get(ANALYTIQUE_PATHS.clesBase);
    return this.json<Record<string, unknown>[]>(response);
  }

  async listerClesRaw(expectStatus?: number[]): Promise<APIResponse> {
    return this.get(ANALYTIQUE_PATHS.clesBase, { expectStatus });
  }

  async appliquerCle(ligneId: string, cleId: string, expectStatus?: number[]) {
    return this.post(ANALYTIQUE_PATHS.appliquerCle(ligneId, cleId), { expectStatus });
  }
}

/** Client du reporting analytique (grand livre, balance, suivi budgétaire). */
export class ReportingAnalytiqueClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async grandLivre(debut: string, fin: string): Promise<Record<string, unknown>[]> {
    const response = await this.get(ANALYTIQUE_PATHS.grandLivre, { params: { debut, fin } });
    return this.json<Record<string, unknown>[]>(response);
  }

  async grandLivreRaw(
    params: Record<string, string | number | boolean>,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.get(ANALYTIQUE_PATHS.grandLivre, { params, expectStatus });
  }

  async balance(debut: string, fin: string): Promise<Record<string, unknown>[]> {
    const response = await this.get(ANALYTIQUE_PATHS.balance, { params: { debut, fin } });
    return this.json<Record<string, unknown>[]>(response);
  }

  async compteResultat(sectionId: string, annee: number, expectStatus?: number[]) {
    return this.get(ANALYTIQUE_PATHS.sectionResultat(sectionId, annee), { expectStatus });
  }

  async suiviBudgetaire(sectionId: string, annee: number, expectStatus?: number[]) {
    return this.get(ANALYTIQUE_PATHS.sectionSuiviBudgetaire(sectionId, annee), { expectStatus });
  }
}
