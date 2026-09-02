import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient, cleanParams } from '../../../helpers/base-api-client';
import { PageQuery, PageRecord } from '../../types/common';
import { COMPTA_PATHS } from '../comptabilite-generale-api-paths';

/** Décision maker-checker, commune à tous les référentiels. */
export interface DecisionBody {
  decision?: 'PENDING' | 'REJECTED' | 'EXPIRED' | 'ACCEPTED';
  notes?: string;
  checkerOperationType?: 'CREATE' | 'UPDATE' | 'UPDATE_IMAGE';
}

/** Client du référentiel des banques. */
export class BanqueClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async page(query: PageQuery = {}): Promise<PageRecord<Record<string, unknown>>> {
    const response = await this.get(COMPTA_PATHS.banqueBase, { params: cleanParams(query) });
    return this.json<PageRecord<Record<string, unknown>>>(response);
  }

  async list(): Promise<Record<string, unknown>[]> {
    const response = await this.get(COMPTA_PATHS.banqueList);
    return this.json<Record<string, unknown>[]>(response);
  }

  async listRaw(expectStatus?: number[]): Promise<APIResponse> {
    return this.get(COMPTA_PATHS.banqueList, { expectStatus });
  }

  async getById(id: string, expectStatus?: number[]) {
    return this.get(COMPTA_PATHS.banque(id), { expectStatus });
  }

  async getActiveById(id: string, expectStatus?: number[]) {
    return this.get(COMPTA_PATHS.banqueActive(id), { expectStatus });
  }

  async initUpdate(id: string, body: Record<string, unknown>, expectStatus?: number[]) {
    return this.put(COMPTA_PATHS.banqueInitUpdate(id), { data: body, expectStatus });
  }

  async validateOrReject(id: string, body: DecisionBody, expectStatus?: number[]) {
    return this.put(COMPTA_PATHS.banqueDecision(id), { data: body, expectStatus });
  }
}

/** Client du plan comptable (comptes généraux). */
export class CompteClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async initCreate(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.compteInitCreate, { data: body, expectStatus });
  }

  async page(query: PageQuery = {}): Promise<PageRecord<Record<string, unknown>>> {
    const response = await this.get(COMPTA_PATHS.compteBase, { params: cleanParams(query) });
    return this.json<PageRecord<Record<string, unknown>>>(response);
  }

  async list(): Promise<Record<string, unknown>[]> {
    const response = await this.get(COMPTA_PATHS.compteList);
    return this.json<Record<string, unknown>[]>(response);
  }

  async listRaw(expectStatus?: number[]): Promise<APIResponse> {
    return this.get(COMPTA_PATHS.compteList, { expectStatus });
  }

  async getById(id: string, expectStatus?: number[]) {
    return this.get(COMPTA_PATHS.compte(id), { expectStatus });
  }

  async getActiveById(id: string, expectStatus?: number[]) {
    return this.get(COMPTA_PATHS.compteActive(id), { expectStatus });
  }

  async initUpdate(id: string, body: Record<string, unknown>, expectStatus?: number[]) {
    return this.put(COMPTA_PATHS.compteInitUpdate(id), { data: body, expectStatus });
  }

  async supprimer(id: string, expectStatus?: number[]) {
    return this.delete(COMPTA_PATHS.compte(id), { expectStatus });
  }

  async validateOrReject(id: string, body: DecisionBody, expectStatus?: number[]) {
    return this.put(COMPTA_PATHS.compteDecision(id), { data: body, expectStatus });
  }
}

/** Client du référentiel des tiers (clients, fournisseurs, personnel). */
export class TiersClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async initCreate(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.tiersInitCreate, { data: body, expectStatus });
  }

  async page(query: PageQuery = {}): Promise<PageRecord<Record<string, unknown>>> {
    const response = await this.get(COMPTA_PATHS.tiersBase, { params: cleanParams(query) });
    return this.json<PageRecord<Record<string, unknown>>>(response);
  }

  async list(): Promise<Record<string, unknown>[]> {
    const response = await this.get(COMPTA_PATHS.tiersList);
    return this.json<Record<string, unknown>[]>(response);
  }

  async listRaw(expectStatus?: number[]): Promise<APIResponse> {
    return this.get(COMPTA_PATHS.tiersList, { expectStatus });
  }

  async getById(id: string, expectStatus?: number[]) {
    return this.get(COMPTA_PATHS.tiers(id), { expectStatus });
  }

  async getActiveById(id: string, expectStatus?: number[]) {
    return this.get(COMPTA_PATHS.tiersActive(id), { expectStatus });
  }

  async initUpdate(id: string, body: Record<string, unknown>, expectStatus?: number[]) {
    return this.put(COMPTA_PATHS.tiersInitUpdate(id), { data: body, expectStatus });
  }

  async validateOrReject(id: string, body: DecisionBody, expectStatus?: number[]) {
    return this.put(COMPTA_PATHS.tiersDecision(id), { data: body, expectStatus });
  }
}

/** Client du référentiel des journaux comptables. */
export class JournalClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async initCreate(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.journalInitCreate, { data: body, expectStatus });
  }

  async page(query: PageQuery = {}): Promise<PageRecord<Record<string, unknown>>> {
    const response = await this.get(COMPTA_PATHS.journalBase, { params: cleanParams(query) });
    return this.json<PageRecord<Record<string, unknown>>>(response);
  }

  async list(): Promise<Record<string, unknown>[]> {
    const response = await this.get(COMPTA_PATHS.journalList);
    return this.json<Record<string, unknown>[]>(response);
  }

  async listRaw(expectStatus?: number[]): Promise<APIResponse> {
    return this.get(COMPTA_PATHS.journalList, { expectStatus });
  }

  async getById(id: string, expectStatus?: number[]) {
    return this.get(COMPTA_PATHS.journal(id), { expectStatus });
  }

  async getActiveById(id: string, expectStatus?: number[]) {
    return this.get(COMPTA_PATHS.journalActive(id), { expectStatus });
  }

  async initUpdate(id: string, body: Record<string, unknown>, expectStatus?: number[]) {
    return this.put(COMPTA_PATHS.journalInitUpdate(id), { data: body, expectStatus });
  }

  async toggle(id: string, expectStatus?: number[]) {
    return this.put(COMPTA_PATHS.journalToggle(id), { expectStatus });
  }

  async validateOrReject(id: string, body: DecisionBody, expectStatus?: number[]) {
    return this.put(COMPTA_PATHS.journalDecision(id), { data: body, expectStatus });
  }
}
