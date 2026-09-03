import { APIResponse, expect } from '@playwright/test';
import { PageRecord } from '../api/types/common';
import { attacherReponse } from './report';

/**
 * Vérifie la cohérence interne d'une page renvoyée par le backend :
 * taille demandée respectée, compteurs alignés sur le contenu, bornes exactes.
 */
export function expectValidPage<T>(
  page: PageRecord<T>,
  options: { expectedPage?: number; expectedSize?: number } = {},
): void {
  expect(Array.isArray(page.content), 'content doit être un tableau').toBeTruthy();
  expect(page.numberOfElements).toBe(page.content.length);
  expect(page.empty).toBe(page.content.length === 0);
  expect(page.content.length).toBeLessThanOrEqual(page.size);
  expect(page.totalElements).toBeGreaterThanOrEqual(page.content.length);
  expect(page.totalPages).toBeGreaterThanOrEqual(0);

  if (options.expectedPage !== undefined) {
    expect(page.number).toBe(options.expectedPage);
    expect(page.first).toBe(options.expectedPage === 0);
  }
  if (options.expectedSize !== undefined) {
    expect(page.size).toBe(options.expectedSize);
  }
  if (page.totalPages > 0) {
    expect(page.last).toBe(page.number === page.totalPages - 1);
  }
}

/** Vérifie qu'un objet expose bien les propriétés attendues, non nulles. */
export function expectHasFields(payload: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    expect(payload, `champ "${field}" absent de la réponse`).toHaveProperty(field);
    expect(payload[field], `champ "${field}" nul`).not.toBeNull();
  }
}

/** Vérifie qu'une chaîne est un UUID. */
export function expectUuid(value: unknown): void {
  expect(String(value)).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
}

/**
 * Vérifie qu'une réponse porte un statut attendu, en remontant le corps dans le
 * message d'échec — indispensable pour diagnostiquer les 500 côté backend.
 */
export async function expectStatusIn(
  response: APIResponse,
  allowed: number[],
  contexte = '',
): Promise<void> {
  await attacherReponse(response);
  if (allowed.includes(response.status())) return;
  const body = await response.text();
  expect(
    allowed,
    `${contexte || response.url()} → statut ${response.status()} ; corps : ${body.slice(0, 500)}`,
  ).toContain(response.status());
}

/** Vérifie qu'une réponse n'est pas un succès (utile sur les cas d'erreur métier). */
export async function expectNotOk(response: APIResponse, contexte = ''): Promise<void> {
  await attacherReponse(response);
  if (!response.ok()) return;
  const body = await response.text();
  expect(
    response.ok(),
    `${contexte || response.url()} aurait dû échouer ; corps : ${body.slice(0, 500)}`,
  ).toBeFalsy();
}

/** Vérifie que le corps est un tableau JSON. */
export async function expectJsonArray(response: APIResponse): Promise<unknown[]> {
  const payload = await response.json();
  expect(Array.isArray(payload), 'la réponse doit être un tableau JSON').toBeTruthy();
  return payload as unknown[];
}

/** Vérifie que le corps est un objet JSON non nul. */
export async function expectJsonObject(response: APIResponse): Promise<Record<string, unknown>> {
  const payload = await response.json();
  expect(payload, 'la réponse doit être un objet JSON').toBeTruthy();
  expect(Array.isArray(payload), 'la réponse ne doit pas être un tableau').toBeFalsy();
  return payload as Record<string, unknown>;
}
