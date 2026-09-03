/**
 * Socle commun des scripts Kiwi TCMS.
 * ---------------------------------------------------------------------------
 * - lecture du .env
 * - client JSON-RPC minimal (cookie de session gere a la main)
 * - helpers Kiwi (Product / Version / Build / TestPlan / TestCase)
 * - lecture du JSON Playwright (rapport d'execution OU sortie de --list)
 *
 * Zero dependance npm : uniquement des modules Node natifs.
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnv();

// Valeurs par defaut derivees de git : chaque execution reste tracable.
function git(cmd, fallback) {
  try {
    return (
      execSync(`git ${cmd}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim() || fallback
    );
  } catch {
    return fallback;
  }
}

export const CFG = {
  url: process.env.TCMS_API_URL || 'https://localhost:8443/json-rpc/',
  username: process.env.TCMS_USERNAME || '',
  password: process.env.TCMS_PASSWORD || '',
  product: process.env.TCMS_PRODUCT || 'ICE',
  version:
    process.env.TCMS_PRODUCT_VERSION || git('rev-parse --abbrev-ref HEAD', 'local'),
  build:
    process.env.TCMS_BUILD ||
    `${git('rev-parse --short HEAD', 'build')}-${new Date()
      .toISOString()
      .slice(0, 16)
      .replace(/[:T]/g, '')}`,
  planId: process.env.TCMS_PLAN_ID ? Number(process.env.TCMS_PLAN_ID) : null,
  runId: process.env.TCMS_RUN_ID ? Number(process.env.TCMS_RUN_ID) : null,
  parentPlan: process.env.TCMS_PARENT_PLAN ? Number(process.env.TCMS_PARENT_PLAN) : null,
  prefix: process.env.TCMS_PREFIX || '[Playwright]',
  planType: process.env.TCMS_PLAN_TYPE || 'Integration',
  priority: process.env.TCMS_PRIORITY || 'P1',
  allureUrl: process.env.ALLURE_REPORT_URL || '',
  excludeProjects: (process.env.TCMS_EXCLUDE_PROJECTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  prefixProject: (process.env.TCMS_PREFIX_PROJECT || 'true').toLowerCase() !== 'false',
  resultsFile:
    process.env.PW_RESULTS_JSON || path.join(ROOT, 'test-results', 'results.json'),
  insecure: (process.env.TCMS_INSECURE_TLS || 'true').toLowerCase() !== 'false',
};

export const CREATED_BY =
  'Cree automatiquement depuis le depot Playwright (scripts/kiwi-*.mjs)';

/* -------------------------------------------------------------------------- */
/* Client JSON-RPC                                                            */
/* -------------------------------------------------------------------------- */

let cookie = '';
let rpcId = 0;

export function rpcCall(method, params = []) {
  const target = new URL(CFG.url);
  const isHttps = target.protocol === 'https:';
  const lib = isHttps ? https : http;
  const payload = JSON.stringify({ jsonrpc: '2.0', method, params, id: ++rpcId });

  const options = {
    hostname: target.hostname,
    port: target.port || (isHttps ? 443 : 80),
    path: target.pathname + target.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      Referer: target.origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    // Kiwi TCMS utilise un certificat auto-signe en local -> on l'accepte.
    ...(isHttps && CFG.insecure ? { rejectUnauthorized: false } : {}),
  };

  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        const jar = new Map(
          cookie
            .split(';')
            .map((c) => c.trim())
            .filter(Boolean)
            .map((c) => [c.split('=')[0], c])
        );
        for (const c of setCookie) {
          const head = c.split(';')[0];
          jar.set(head.split('=')[0], head);
        }
        cookie = [...jar.values()].join('; ');
      }

      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        if (res.statusCode >= 400 && !body.trim().startsWith('{')) {
          return reject(
            new Error(`HTTP ${res.statusCode} sur ${CFG.url} — reponse: ${body.slice(0, 200)}`)
          );
        }
        let json;
        try {
          json = JSON.parse(body);
        } catch {
          return reject(
            new Error(
              `Reponse non-JSON de ${CFG.url} (HTTP ${res.statusCode}). ` +
                `Verifie TCMS_API_URL — il doit se terminer par /json-rpc/`
            )
          );
        }
        if (json.error) {
          return reject(
            new Error(`${method} -> ${json.error.message || JSON.stringify(json.error)}`)
          );
        }
        resolve(json.result);
      });
    });
    req.on('error', (e) =>
      reject(new Error(`Connexion impossible a ${CFG.url} : ${e.message}`))
    );
    req.write(payload);
    req.end();
  });
}

export async function login() {
  if (!CFG.username || !CFG.password) {
    throw new Error(
      'TCMS_USERNAME / TCMS_PASSWORD manquants. Renseigne-les dans le fichier .env'
    );
  }
  await rpcCall('Auth.login', [CFG.username, CFG.password]);
  return CFG.username;
}

/* -------------------------------------------------------------------------- */
/* Helpers Kiwi                                                               */
/* -------------------------------------------------------------------------- */

export const first = (arr) => (Array.isArray(arr) && arr.length ? arr[0] : null);

export async function pickId(model, query, fallbackQuery = {}) {
  let rows = await rpcCall(`${model}.filter`, [query]);
  if (!first(rows)) rows = await rpcCall(`${model}.filter`, [fallbackQuery]);
  const row = first(rows);
  if (!row) throw new Error(`Aucun enregistrement ${model} trouve dans Kiwi TCMS.`);
  return row.id;
}

export function nowSql(d = new Date()) {
  return new Date(d).toISOString().replace('T', ' ').slice(0, 19);
}

/** Product / Version / Build : crees s'ils n'existent pas. */
export async function ensureProduct({ withBuild = true } = {}) {
  let product = first(await rpcCall('Product.filter', [{ name: CFG.product }]));
  if (!product) {
    const classificationId = await pickId('Classification', {});
    product = await rpcCall('Product.create', [
      { name: CFG.product, classification: classificationId },
    ]);
    console.log(`Product cree : ${CFG.product} (#${product.id})`);
  }

  let version = first(
    await rpcCall('Version.filter', [{ product: product.id, value: CFG.version }])
  );
  if (!version) {
    version = await rpcCall('Version.create', [
      { product: product.id, value: CFG.version },
    ]);
    console.log(`Version creee : ${CFG.version} (#${version.id})`);
  }

  let build = null;
  if (withBuild) {
    build = first(await rpcCall('Build.filter', [{ name: CFG.build, version: version.id }]));
    if (!build) {
      build = await rpcCall('Build.create', [{ name: CFG.build, version: version.id }]);
      console.log(`Build cree : ${CFG.build} (#${build.id})`);
    }
  }

  return { product, version, build };
}

/** TestPlan : TCMS_PLAN_ID s'il est defini, sinon get-or-create. */
export async function ensurePlan(product, version) {
  if (CFG.planId) {
    const row = first(await rpcCall('TestPlan.filter', [{ pk: CFG.planId }]));
    if (!row) throw new Error(`TestPlan #${CFG.planId} introuvable dans Kiwi.`);
    return row;
  }
  const name = `${CFG.prefix} Plan ${CFG.product} (${CFG.version})`.slice(0, 255);
  let plan = first(
    await rpcCall('TestPlan.filter', [
      { name, product: product.id, product_version: version.id },
    ])
  );
  if (!plan) {
    const typeId = await pickId('PlanType', { name: CFG.planType });
    const args = {
      name,
      text: CREATED_BY,
      product: product.id,
      product_version: version.id,
      is_active: true,
      type: typeId,
    };
    if (CFG.parentPlan) args.parent = CFG.parentPlan;
    plan = await rpcCall('TestPlan.create', [args]);
    console.log(`TestPlan cree : ${name} (#${plan.id})`);
  }
  // TestPlan.create ne renvoie pas toujours "author" -> on relit la ligne
  return first(await rpcCall('TestPlan.filter', [{ pk: plan.id }])) || plan;
}

/** Referentiels necessaires a la creation d'un TestCase. */
export async function caseDefaults(product) {
  return {
    categoryId: await pickId('Category', { product: product.id }),
    priorityId: await pickId('Priority', { value: CFG.priority }),
    confirmedId: await pickId('TestCaseStatus', { name: 'CONFIRMED' }),
  };
}

/**
 * Retrouve ou cree le TestCase correspondant a un test Playwright.
 * @returns {{ testCase: object, created: boolean }}
 */
export async function testCaseGetOrCreate(t, product, defaults) {
  const summary = cleanSummary(t) || t.rawTitle;
  const pinned = explicitCaseId(t.title);

  let testCase = null;
  if (pinned) {
    testCase = first(await rpcCall('TestCase.filter', [{ pk: pinned }]));
    if (!testCase) console.warn(`  ! TC-${pinned} introuvable, creation par summary`);
  }
  if (!testCase) {
    testCase = first(
      await rpcCall('TestCase.filter', [{ summary, category__product: product.id }])
    );
  }
  if (testCase) return { testCase, created: false, summary };

  testCase = await rpcCall('TestCase.create', [
    {
      summary,
      category: defaults.categoryId,
      priority: defaults.priorityId,
      case_status: defaults.confirmedId,
      notes: `${CREATED_BY}\nFichier : ${t.file}${t.line ? ':' + t.line : ''}`,
      is_automated: true,
    },
  ]);
  return { testCase, created: true, summary };
}

/** Rattache un cas a un plan (sans echouer s'il y est deja). */
export async function addCaseToPlan(planId, caseId) {
  try {
    await rpcCall('TestPlan.add_case', [planId, caseId]);
  } catch {
    /* deja rattache */
  }
}

/* -------------------------------------------------------------------------- */
/* Lecture du JSON Playwright                                                 */
/* -------------------------------------------------------------------------- */

/** Aplatit l'arbre de suites (format identique pour un run et pour --list). */
export function flattenSuites(suites, acc = [], titles = []) {
  for (const suite of suites || []) {
    const trail = suite.title ? [...titles, suite.title] : titles;
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        const last = t.results?.[t.results.length - 1] || {};
        acc.push({
          title: [...trail, spec.title].filter(Boolean).join(' > '),
          rawTitle: spec.title,
          file: suite.file || spec.file || '',
          line: spec.line || 0,
          project: t.projectName || '',
          status: last.status || t.status || 'skipped',
          expected: t.expectedStatus || 'passed',
          duration: last.duration || 0,
          startTime: last.startTime || null,
          error:
            last.error?.message ||
            (last.errors || []).map((e) => e.message).join('\n') ||
            '',
          stdout: (last.stdout || []).map((c) => c.text || '').join('').slice(0, 2000),
        });
      }
    }
    if (suite.suites?.length) flattenSuites(suite.suites, acc, trail);
  }
  return acc;
}

export function readPlaywrightJson(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Fichier JSON Playwright introuvable : ${file}`);
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return flattenSuites(data.suites);
}

/** Retire les projets exclus (TCMS_EXCLUDE_PROJECTS). */
export function filterProjects(tests) {
  if (!CFG.excludeProjects.length) return tests;
  const kept = tests.filter((t) => !CFG.excludeProjects.includes(t.project));
  const skipped = tests.length - kept.length;
  if (skipped) {
    console.log(
      `${skipped} test(s) ignore(s) (projets : ${CFG.excludeProjects.join(', ')})`
    );
  }
  return kept;
}

/* -------------------------------------------------------------------------- */
/* Nommage / statuts                                                          */
/* -------------------------------------------------------------------------- */

/** Un tag @TC-123 dans le titre rattache le test a un cas Kiwi existant. */
export function explicitCaseId(title) {
  const m = title.match(/@TC-(\d+)/i);
  return m ? Number(m[1]) : null;
}

export function cleanSummary(t) {
  const title = typeof t === 'string' ? t : t.title;
  const project = typeof t === 'string' ? '' : t.project || '';
  const core = title
    // le fichier est deja dans les notes du cas -> on l'enleve du summary
    .replace(/^[^>]*\.spec\.(ts|js|mjs)\s*>\s*/i, '')
    .replace(/@TC-\d+/gi, '')
    .replace(/@\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // le prefixe projet evite les collisions entre suites api / ui
  const full = CFG.prefixProject && project ? `[${project}] ${core}` : core;
  return full.slice(0, 255);
}

/** Playwright -> Kiwi TCMS */
export function kiwiStatusName(t) {
  if (t.status === 'passed' || (t.status === 'failed' && t.expected === 'failed')) {
    return 'PASSED';
  }
  if (t.status === 'skipped') return 'WAIVED';
  if (t.status === 'timedOut') return 'ERROR';
  if (t.status === 'interrupted') return 'BLOCKED';
  return 'FAILED';
}
