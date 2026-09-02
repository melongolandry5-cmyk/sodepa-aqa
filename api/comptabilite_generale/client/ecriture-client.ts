import { APIRequestContext } from '@playwright/test';
import { BaseApiClient } from '../../../helpers/base-api-client';
import { COMPTA_PATHS } from '../comptabilite-generale-api-paths';

/** Client des écritures comptables : saisie, TVA, workflow de validation. */
export class EcritureClient extends BaseApiClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async saisir(body: Record<string, unknown>, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.ecritureBase, { data: body, expectStatus });
  }

  async simulerTva(
    body: { montantHt?: number; tauxTva?: number; compteHtCode?: string },
    expectStatus?: number[],
  ) {
    return this.post(COMPTA_PATHS.ecritureSimulerTva, { data: body, expectStatus });
  }

  async soumettre(id: string, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.ecritureSoumettre(id), { expectStatus });
  }

  async valider(id: string, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.ecritureValider(id), { expectStatus });
  }

  async rejeter(id: string, expectStatus?: number[]) {
    return this.post(COMPTA_PATHS.ecritureRejeter(id), { expectStatus });
  }

  async getById(id: string, expectStatus?: number[]) {
    return this.get(COMPTA_PATHS.ecriture(id), { expectStatus });
  }
}
