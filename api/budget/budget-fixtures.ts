import { baseTest, BaseTestFixtures, BaseWorkerFixtures } from '../../helpers/base-fixtures';
import { BudgetPlanClient } from './client/budget-plan-client';
import {
  BudgetCollaboratifClient,
  EngagementWorkflowClient,
} from './client/budget-collaboratif-client';
import { UserClient } from '../user_management/client/user-client';

/**
 * Clients injectes dans les tests du module Budget.
 *
 * Le client Utilisateur vient du module Gestion des utilisateurs : creer un
 * plan budgetaire suppose un utilisateur existant comme porteur.
 */
interface BudgetFixtures {
  budgetClient: BudgetPlanClient;
  budgetCollaboratifClient: BudgetCollaboratifClient;
  engagementWorkflowClient: EngagementWorkflowClient;
  userClient: UserClient;
}

export const test = baseTest.extend<BudgetFixtures & BaseTestFixtures, BaseWorkerFixtures>({
  budgetClient: async ({ apiContext }, use) => use(new BudgetPlanClient(apiContext)),
  budgetCollaboratifClient: async ({ apiContext }, use) =>
    use(new BudgetCollaboratifClient(apiContext)),
  engagementWorkflowClient: async ({ apiContext }, use) =>
    use(new EngagementWorkflowClient(apiContext)),
  userClient: async ({ apiContext }, use) => use(new UserClient(apiContext)),
});

export { expect } from '@playwright/test';
