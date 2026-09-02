import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient, cleanParams } from '../../../helpers/base-api-client';
import { PageQuery, PageRecord } from '../../types/common';
import { COMPTA_PATHS } from '../comptabilite-generale-api-paths';

/** Client des immobilisations et de leurs plans d'amortissement. */
export class ImmobilisationClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async page(
    query: PageQuery & { recherche?: string; statut?: string } = {},
  ): Promise<PageRecord<Record<string, unknown>>> {
    const response = await this.get(COMPTA_PATHS.immoBase, { params: cleanParams(query) });
    return this.json<PageRecord<Record<string, unknown>>>(response);
  }

  async pageRaw(
    params: Record<string, string | number | boolean>,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.get(COMPTA_PATHS.immoBase, { params, expectStatus });
  }

  async pending(query: PageQuery = {}): Promise<PageRecord<Record<string, unknown>>> {
    const response = await this.get(COMPTA_PATHS.immoPending, { params: cleanParams(query) });
    return this.json<PageRecord<Record<string, unknown>>>(response);
  }

  async getById(id: string, expectStatus?: number[]) {
    return this.get(COMPTA_PATHS.immo(id), { expectStatus });
  }

  async planAmortissement(id: string, expectStatus?: number[]) {
    return this.get(COMPTA_PATHS.immoPlan(id), { expectStatus });
  }

  async initCreate(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.immoInitCreate, { data: body, expectStatus });
  }

  async initUpdate(id: string, body: Record<string, unknown>, expectStatus?: number[]) {
    return this.put(COMPTA_PATHS.immoInitUpdate(id), { data: body, expectStatus });
  }

  async initAmortir(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.immoInitAmortir, { data: body, expectStatus });
  }

  async validateOrReject(id: string, body: Record<string, unknown>, expectStatus?: number[]) {
    return this.put(COMPTA_PATHS.immoDecision(id), { data: body, expectStatus });
  }
}
