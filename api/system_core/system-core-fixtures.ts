import { baseTest, BaseTestFixtures, BaseWorkerFixtures } from '../../helpers/base-fixtures';

/**
 * Les tests transverses n'ont besoin d'aucun client metier : ils travaillent
 * directement sur les contextes HTTP et sur le registre des routes.
 */
export const test = baseTest.extend<BaseTestFixtures, BaseWorkerFixtures>({});

export { expect } from '@playwright/test';
