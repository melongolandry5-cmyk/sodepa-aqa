import { env } from '../helpers/env';

/** Identifiants d'un compte de test. */
export interface TestUser {
  username: string;
  password: string;
}

/** Comptes utilisés par les tests, alimentés par le .env. */
export const users: Record<'admin' | 'comptable', TestUser> = {
  admin: { ...env.users.admin },
  comptable: { ...env.users.comptable },
};
