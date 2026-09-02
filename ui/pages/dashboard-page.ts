import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './base-page';

/** Page d'accueil après connexion. */
export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page, '/');
  }

  get mainNav(): Locator {
    return this.page.getByRole('navigation');
  }

  get userMenu(): Locator {
    return this.page.getByRole('button', { name: /compte|profil|utilisateur/i });
  }

  async expectDisplayed(): Promise<void> {
    await expect(this.mainNav).toBeVisible();
  }
}
