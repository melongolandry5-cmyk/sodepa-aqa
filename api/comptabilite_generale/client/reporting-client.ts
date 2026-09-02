import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient } from '../../../helpers/base-api-client';
import { COMPTA_PATHS } from '../comptabilite-generale-api-paths';

/** Client des états comptables OHADA. */
export class ReportingClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async livreJournal(debut: string, fin: string): Promise<Record<string, unknown>[]> {
    const response = await this.get(COMPTA_PATHS.livreJournal, { params: { debut, fin } });
    return this.json<Record<string, unknown>[]>(response);
  }

  async livreJournalRaw(
    params: Record<string, string | number | boolean>,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.get(COMPTA_PATHS.livreJournal, { params, expectStatus });
  }

  async grandLivre(debut: string, fin: string): Promise<Record<string, unknown>[]> {
    const response = await this.get(COMPTA_PATHS.grandLivre, { params: { debut, fin } });
    return this.json<Record<string, unknown>[]>(response);
  }

  async balance(debut: string, fin: string): Promise<Record<string, unknown>[]> {
    const response = await this.get(COMPTA_PATHS.balance, { params: { debut, fin } });
    return this.json<Record<string, unknown>[]>(response);
  }

  async balanceRaw(
    params: Record<string, string | number | boolean>,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.get(COMPTA_PATHS.balance, { params, expectStatus });
  }

  async bilan(dateBilan: string): Promise<Record<string, unknown>> {
    const response = await this.get(COMPTA_PATHS.bilan, { params: { dateBilan } });
    return this.json<Record<string, unknown>>(response);
  }

  async bilanRaw(expectStatus?: number[]): Promise<APIResponse> {
    return this.get(COMPTA_PATHS.bilan, { expectStatus });
  }

  async compteResultat(annee: number): Promise<Record<string, unknown>> {
    const response = await this.get(COMPTA_PATHS.compteResultat, { params: { annee } });
    return this.json<Record<string, unknown>>(response);
  }

  async compteResultatRaw(expectStatus?: number[]): Promise<APIResponse> {
    return this.get(COMPTA_PATHS.compteResultat, { expectStatus });
  }

  async tft(annee: number): Promise<Record<string, unknown>> {
    const response = await this.get(COMPTA_PATHS.tft, { params: { annee } });
    return this.json<Record<string, unknown>>(response);
  }

  async tva(annee: number, mois: number): Promise<Record<string, unknown>> {
    const response = await this.get(COMPTA_PATHS.tva, { params: { annee, mois } });
    return this.json<Record<string, unknown>>(response);
  }

  async tvaRaw(
    params: Record<string, string | number | boolean>,
    expectStatus?: number[],
  ): Promise<APIResponse> {
    return this.get(COMPTA_PATHS.tva, { params, expectStatus });
  }

  async fec(annee: number): Promise<string> {
    const response = await this.get(COMPTA_PATHS.fec, { params: { annee } });
    return response.text();
  }

  async fecRaw(expectStatus?: number[]): Promise<APIResponse> {
    return this.get(COMPTA_PATHS.fec, { expectStatus });
  }
}
