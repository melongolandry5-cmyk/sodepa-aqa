import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './base-page';
import { TestUser } from '../../test-data/users';

/**
 * Écran de connexion.
 *
 * Les locators s'appuient sur les rôles ARIA ; ajuster les libellés dès que le
 * front réel est disponible (idéalement en ajoutant des `data-testid`).
 */
export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page, '/login');
  }

  get username(): Locator {
    return this.page.getByLabel(/utilisateur|identifiant|username/i);
  }

  get password(): Locator {
    return this.page.getByLabel(/mot de passe|password/i);
  }

  get submit(): Locator {
    return this.page.getByRole('button', { name: /connexion|se connecter|login/i });
  }

  get errorMessage(): Locator {
    return this.page.getByRole('alert');
  }

  async login(user: TestUser): Promise<void> {
    await this.username.fill(user.username);
    await this.password.fill(user.password);
    await this.submit.click();
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.submit).toBeVisible();
  }
}
