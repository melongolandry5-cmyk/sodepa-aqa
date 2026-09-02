import { EndpointDescriptor, UUID_ZERO } from '../types/endpoint';

const BASE_AUDIT = '/api/auth/audit';
const BASE_TRAIL = '/api/audit';

/** Chemins du module Audit (journal technique ClickHouse et piste métier). */
export const AUDIT_PATHS = {
  base: BASE_AUDIT,
  activities: `${BASE_AUDIT}/activities`,
  clickhouseTransactions: `${BASE_AUDIT}/clickhouse/transactions`,
  clickhouseActivities: `${BASE_AUDIT}/clickhouse/activities`,
  analytics: `${BASE_AUDIT}/analytics`,
  trailBase: BASE_TRAIL,
  trailLogs: `${BASE_TRAIL}/logs`,
} as const;

export const AUDIT_ENDPOINTS: EndpointDescriptor[] = [
  { method: 'get', path: AUDIT_PATHS.activities, domain: 'audit' },
  { method: 'get', path: AUDIT_PATHS.clickhouseTransactions, domain: 'audit' },
  { method: 'get', path: AUDIT_PATHS.clickhouseActivities, domain: 'audit' },
  {
    method: 'get',
    path: AUDIT_PATHS.analytics,
    domain: 'audit',
    sampleParams: { query: 'SELECT 1' },
  },
  {
    method: 'get',
    path: AUDIT_PATHS.trailLogs,
    domain: 'audit',
    sampleParams: { entiteNom: 'BudgetPlan', entiteId: UUID_ZERO },
  },
];
