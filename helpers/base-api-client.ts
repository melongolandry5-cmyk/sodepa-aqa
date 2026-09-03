import { APIRequestContext, APIResponse, expect, test } from '@playwright/test';
import { attacher, corpsLisible, masquer } from './report';

/** Options d'un appel HTTP. */
export interface CallOptions {
  params?: Record<string, string | number | boolean>;
  data?: unknown;
  headers?: Record<string, string>;
  /**
   * Codes HTTP acceptés. Par défaut toute réponse 2xx ; passer une liste pour
   * examiner soi-même une réponse en erreur.
   */
  expectStatus?: number | number[];
}

/**
 * Socle commun aux clients REST : vérification du code retour et
 * désérialisation JSON.
 *
 * Les chemins passés aux verbes sont absolus et proviennent du fichier
 * `*-api-paths.ts` du module — aucun client ne concatène d'URL en dur.
 *
 * Les verbes sont publics : les tests d'erreur s'en servent directement avec
 * `expectStatus` plutôt que de multiplier les méthodes « raw » par endpoint.
 */
export abstract class BaseApiClient {
  protected constructor(protected readonly request: APIRequestContext) {}

  async get(path: string, options: CallOptions = {}): Promise<APIResponse> {
    return this.appel('get', path, options);
  }

  async post(path: string, options: CallOptions = {}): Promise<APIResponse> {
    return this.appel('post', path, options);
  }

  async put(path: string, options: CallOptions = {}): Promise<APIResponse> {
    return this.appel('put', path, options);
  }

  async delete(path: string, options: CallOptions = {}): Promise<APIResponse> {
    return this.appel('delete', path, options);
  }

  /**
   * Point de passage unique des appels HTTP.
   *
   * Chaque appel devient une etape du rapport, avec la requete envoyee et la
   * reponse recue en piece jointe : le rapport Allure documente ainsi les
   * donnees de test reellement echangees, y compris quand l'appel echoue.
   */
  private async appel(
    methode: 'get' | 'post' | 'put' | 'delete',
    path: string,
    options: CallOptions,
  ): Promise<APIResponse> {
    return test.step(`${methode.toUpperCase()} ${path}`, async () => {
      await attacher('requete', {
        methode: methode.toUpperCase(),
        chemin: path,
        parametres: options.params,
        corps: masquer(options.data),
      });

      const envoi = { params: options.params, headers: options.headers };
      const response =
        methode === 'get'
          ? await this.request.get(path, envoi)
          : methode === 'delete'
            ? await this.request.delete(path, envoi)
            : methode === 'put'
              ? await this.request.put(path, { ...envoi, data: options.data as never })
              : await this.request.post(path, { ...envoi, data: options.data as never });

      await attacher('reponse', {
        statut: response.status(),
        url: response.url(),
        corps: await corpsLisible(response),
      });

      await this.assertStatus(response, options.expectStatus);
      return response;
    });
  }


  /** Lit le corps JSON d'une réponse en le typant. */
  async json<T>(response: APIResponse): Promise<T> {
    return (await response.json()) as T;
  }

  private async assertStatus(response: APIResponse, expected?: number | number[]): Promise<void> {
    if (expected === undefined) {
      if (!response.ok()) {
        const body = await response.text();
        expect(
          response.ok(),
          `${response.status()} sur ${response.url()} — corps : ${body.slice(0, 500)}`,
        ).toBeTruthy();
      }
      return;
    }
    const allowed = Array.isArray(expected) ? expected : [expected];
    if (!allowed.includes(response.status())) {
      const body = await response.text();
      expect(
        allowed,
        `Statut ${response.status()} inattendu sur ${response.url()} — corps : ${body.slice(0, 500)}`,
      ).toContain(response.status());
    }
  }
}

/** Retire les paramètres non renseignés avant l'appel HTTP. */
export function cleanParams(input: object): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ) as Record<string, string | number | boolean>;
}
