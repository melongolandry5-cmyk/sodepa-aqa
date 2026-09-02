import { env } from './env';

/** Journalisation minimale, préfixée, activable via DEBUG_AQA=true. */

export const logger = {
  info(message: string, ...args: unknown[]): void {
    if (env.debug) console.log(`[aqa] ${message}`, ...args);
  },
  warn(message: string, ...args: unknown[]): void {
    console.warn(`[aqa] ${message}`, ...args);
  },
};
