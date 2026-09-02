import { Locator, Page, expect } from '@playwright/test';

/** Socle des Page Objects : navigation, attentes et accès aux notifications. */
export abstract class BasePage {
  protected constructor(
    protected readonly page: Page,
    /** Chemin relatif à UI_BASE_URL. */
    protected readonly path: string,
  ) {}

  async goto(): Promise<void> {
    await this.page.goto(this.path, { waitUntil: 'domcontentloaded' });
  }

  /** Attend la fin des requêtes réseau déclenchées par la navigation. */
  async waitLoaded(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /** Message d'erreur ou de succès affiché par l'application. */
  get toast(): Locator {
    return this.page.getByRole('alert');
  }

  async expectToast(text: string | RegExp): Promise<void> {
    await expect(this.toast).toContainText(text);
  }
}
