import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient, cleanParams } from '../../../helpers/base-api-client';
import { PageQuery, PageRecord } from '../../types/common';
import { USER_PATHS } from '../user-management-api-paths';

/** Client des endpoints /api/v1/users. */
export class UserClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async page(query: PageQuery = {}): Promise<PageRecord<Record<string, unknown>>> {
    const response = await this.get(USER_PATHS.base, { params: cleanParams(query) });
    return this.json<PageRecord<Record<string, unknown>>>(response);
  }

  async pending(query: PageQuery = {}): Promise<PageRecord<Record<string, unknown>>> {
    const response = await this.get(USER_PATHS.pending, { params: cleanParams(query) });
    return this.json<PageRecord<Record<string, unknown>>>(response);
  }

  async search(
    query: PageQuery & { nom?: string; prenom?: string; email?: string; telephone?: string } = {},
  ): Promise<PageRecord<Record<string, unknown>>> {
    const response = await this.get(USER_PATHS.search, { params: cleanParams(query) });
    return this.json<PageRecord<Record<string, unknown>>>(response);
  }

  async getById(id: string, expectStatus?: number[]) {
    return this.get(USER_PATHS.byId(id), { expectStatus });
  }

  async initCreateJson(body: Record<string, unknown>, expectStatus?: number[]): Promise<APIResponse> {
    return this.post(USER_PATHS.initCreate, { data: body, expectStatus });
  }

  async initUpdate(id: string, body: Record<string, unknown>, expectStatus?: number[]) {
    return this.put(USER_PATHS.initUpdate(id), { data: body, expectStatus });
  }

  async initUpdatePermissions(id: string, body: Record<string, unknown>, expectStatus?: number[]) {
    return this.put(USER_PATHS.initUpdatePermissions(id), { data: body, expectStatus });
  }

  async validateOrReject(id: string, body: Record<string, unknown>, expectStatus?: number[]) {
    return this.put(USER_PATHS.decision(id), { data: body, expectStatus });
  }
}
