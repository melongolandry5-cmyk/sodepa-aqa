import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/** Lit une variable d'environnement obligatoire. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Copier .env.example vers .env et la renseigner.`,
    );
  }
  return value;
}

/** Lit une variable d'environnement avec valeur par défaut. */
function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

/** Résout un chemin du .env par rapport à la racine du dépôt AQA. */
function resolvePath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return path.isAbsolute(value) ? value : path.resolve(__dirname, '..', value);
}

export const env = {
  apiBaseUrl: optional('API_BASE_URL', 'http://localhost:8082'),
  uiBaseUrl: optional('UI_BASE_URL', 'http://localhost:4200'),
  apiTimeoutMs: Number(optional('API_TIMEOUT_MS', '30000')),
  headless: optional('HEADLESS', 'true') !== 'false',
  /**
   * Autorise les tests qui modifient l'état de façon difficilement réversible
   * (clôture d'exercice, suppression de compte, changement de mot de passe).
   */
  runDestructive: optional('RUN_DESTRUCTIVE', 'false') === 'true',
  /**
   * Sources Java du backend, utilisées par le seul garde-fou de couverture
   * (`api/system_core/tests/surface.spec.ts`). C'est la seule adhérence du
   * dépôt AQA au dépôt backend, et elle est facultative : sans elle le
   * garde-fou se met en skip et le reste de la suite tourne normalement.
   */
  backendSourcePath: resolvePath(process.env.BACKEND_SOURCE_PATH),
  isCI: !!process.env.CI,
  users: {
    admin: {
      username: optional('ADMIN_USERNAME', 'admin'),
      password: optional('ADMIN_PASSWORD', 'DefaultPassword123!'),
    },
    comptable: {
      username: optional('COMPTABLE_USERNAME', 'comptable'),
      password: optional('COMPTABLE_PASSWORD', 'DefaultPassword123!'),
    },
  },
} as const;

export { required };
