import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { LoginPage } from '../pages/login-page';
import { users } from '../../test-data/users';
import { env } from '../../helpers/env';
import { logger } from '../../helpers/logger';

const STORAGE_STATE = path.resolve(__dirname, '../../.auth/user.json');

/**
 * Authentifie l'UI une fois pour toutes et sérialise la session.
 *
 * Tant que le front n'est pas déployé sur UI_BASE_URL, on écrit un état vide
 * pour que le projet `ui-chromium` reste démarrable, et on saute la connexion.
 */
setup('authentification UI', async ({ page }) => {
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });

  const reachable = await page
    .goto('/login', { waitUntil: 'domcontentloaded', timeout: 10_000 })
    .then((response) => !!response)
    .catch(() => false);

  if (!reachable) {
    fs.writeFileSync(STORAGE_STATE, JSON.stringify({ cookies: [], origins: [] }, null, 2));
    logger.warn(`Front injoignable sur ${env.uiBaseUrl} : session UI vide, tests UI ignorés.`);
    setup.skip(true, `UI indisponible sur ${env.uiBaseUrl}`);
    return;
  }

  const loginPage = new LoginPage(page);
  await loginPage.expectDisplayed();
  await loginPage.login(users.admin);
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.context().storageState({ path: STORAGE_STATE });
});
