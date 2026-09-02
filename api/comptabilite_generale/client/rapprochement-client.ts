import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient, cleanParams } from '../../../helpers/base-api-client';
import { PageQuery, PageRecord } from '../../types/common';
import { COMPTA_PATHS } from '../comptabilite-generale-api-paths';

/** Client des relevés bancaires et du rapprochement comptable. */
export class RapprochementClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async listerReleves(
    query: PageQuery & { banqueId?: string; valide?: boolean } = {},
  ): Promise<PageRecord<Record<string, unknown>>> {
    const response = await this.get(COMPTA_PATHS.releves, { params: cleanParams(query) });
    return this.json<PageRecord<Record<string, unknown>>>(response);
  }

  async listerRelevesRaw(
    params: Record<string, string | number | boolean>,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.get(COMPTA_PATHS.releves, { params, expectStatus });
  }

  async getReleve(releveId: string, expectStatus?: number[]) {
    return this.get(COMPTA_PATHS.releve(releveId), { expectStatus });
  }

  async saisirReleveManuel(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.releveManuel, { data: body, expectStatus });
  }

  async synchroniser(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.releveSynchroniser, { data: body, expectStatus });
  }

  async rapprocher(releveId: string, compteBanqueCode: string, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.releveRapprocher(releveId), {
      params: { compteBanqueCode },
      expectStatus,
    });
  }

  async rapprocherSansCompte(releveId: string, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.releveRapprocher(releveId), { expectStatus });
  }
}

/** Client de la clôture d'exercice et de la réévaluation des devises. */
export class ClotureClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async cloturerExercice(annee: number, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.clotureExercice(annee), { expectStatus });
  }

  /** Variante non typée, pour tester le rejet d'une année non numérique. */
  async cloturerChemin(segment: string, expectStatus?: number[]) {
    return this.post(`${COMPTA_PATHS.clotureBase}/${segment}`, { expectStatus });
  }

  async reevaluerDevises(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.clotureReevaluer, { data: body, expectStatus });
  }
}
