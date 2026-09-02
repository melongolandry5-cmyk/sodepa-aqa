import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient, cleanParams } from '../../../helpers/base-api-client';
import { TRESORERIE_PATHS } from '../tresorerie-api-paths';

/** Client des endpoints /api/tresorerie (prévisions, cash-flow, BFR). */
export class TresorerieClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async listerPrevisions(debut: string, fin: string): Promise<Record<string, unknown>[]> {
    const response = await this.get(TRESORERIE_PATHS.previsions, { params: { debut, fin } });
    return this.json<Record<string, unknown>[]>(response);
  }

  async listerPrevisionsRaw(
    params: Record<string, string | number | boolean>,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.get(TRESORERIE_PATHS.previsions, { params, expectStatus });
  }

  async ajouterPrevision(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(TRESORERIE_PATHS.previsions, { data: body, expectStatus });
  }

  async cashFlow(debut: string, fin: string): Promise<Record<string, unknown>[]> {
    const response = await this.get(TRESORERIE_PATHS.cashFlow, { params: { debut, fin } });
    return this.json<Record<string, unknown>[]>(response);
  }

  async cashFlowRaw(
    params: Record<string, string | number | boolean>,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.get(TRESORERIE_PATHS.cashFlow, { params, expectStatus });
  }

  async bfr(date: string): Promise<Record<string, unknown>> {
    const response = await this.get(TRESORERIE_PATHS.bfr, { params: { date } });
    return this.json<Record<string, unknown>>(response);
  }

  async bfrRaw(expectStatus?: number[]): Promise<APIResponse> {
    return this.get(TRESORERIE_PATHS.bfr, { expectStatus });
  }

  async alertesDecouvert(): Promise<Record<string, unknown>[]> {
    const response = await this.get(TRESORERIE_PATHS.alertesDecouvert);
    return this.json<Record<string, unknown>[]>(response);
  }

  async whatIf(
    croissance: number,
    inflation: number,
    prixRevient: number,
  ): Promise<Record<string, unknown>> {
    const response = await this.get(TRESORERIE_PATHS.whatIf, {
      params: { croissance, inflation, prixRevient },
    });
    return this.json<Record<string, unknown>>(response);
  }

  async whatIfRaw(
    params: Record<string, string | number | boolean>,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.get(TRESORERIE_PATHS.whatIf, { params, expectStatus });
  }
}

/** Client des endpoints /api/tresorerie/change (couverture de change). */
export class ChangeHedgingClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async listerCouvertures(
    query: { devise?: string; statut?: string } = {},
  ): Promise<Record<string, unknown>[]> {
    const response = await this.get(TRESORERIE_PATHS.couvertures, { params: cleanParams(query) });
    return this.json<Record<string, unknown>[]>(response);
  }

  async enregistrerCouverture(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(TRESORERIE_PATHS.couvertures, { data: body, expectStatus });
  }

  async evaluer(id: string, coursSpot: number, expectStatus?: number[]) {
    return this.get(TRESORERIE_PATHS.couvertureEvaluer(id), {
      params: { coursSpot },
      expectStatus,
    });
  }

  async evaluerSansCours(id: string, expectStatus?: number[]) {
    return this.get(TRESORERIE_PATHS.couvertureEvaluer(id), { expectStatus });
  }
}

/** Client des endpoints /api/tresorerie/rapprochement (matching et arbitrage). */
export class RapprochementBancaireClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async matcher(releveId: string, expectStatus?: number[]) {
    return this.post(TRESORERIE_PATHS.matching, { params: { releveId }, expectStatus });
  }

  async matcherSansReleve(expectStatus?: number[]) {
    return this.post(TRESORERIE_PATHS.matching, { expectStatus });
  }

  async arbitrage(
    fondsSecurite: number,
    debut: string,
    fin: string,
    soldeActuel: number,
  ): Promise<Record<string, unknown>[]> {
    const response = await this.get(TRESORERIE_PATHS.arbitrage, {
      params: { fondsSecurite, debut, fin, soldeActuel },
    });
    return this.json<Record<string, unknown>[]>(response);
  }

  async arbitrageRaw(
    params: Record<string, string | number | boolean>,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.get(TRESORERIE_PATHS.arbitrage, { params, expectStatus });
  }
}

/** Client des endpoints /api/reporting (pilotage stratégique). */
export class PilotageClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async tft(annee: number): Promise<Record<string, unknown>> {
    const response = await this.get(TRESORERIE_PATHS.tft, { params: { annee } });
    return this.json<Record<string, unknown>>(response);
  }

  async tftRaw(
    params: Record<string, string | number | boolean> | undefined,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.get(TRESORERIE_PATHS.tft, { params, expectStatus });
  }

  async runway(): Promise<Record<string, unknown>> {
    const response = await this.get(TRESORERIE_PATHS.runway);
    return this.json<Record<string, unknown>>(response);
  }
}
