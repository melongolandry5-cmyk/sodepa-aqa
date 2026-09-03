#!/usr/bin/env node
/**
 * Pont Playwright -> Kiwi TCMS : pousse les RESULTATS d'execution.
 * ---------------------------------------------------------------------------
 * Lit le rapport JSON de Playwright (test-results/results.json) et met a jour
 * Kiwi TCMS via son API JSON-RPC (/json-rpc/).
 *
 *   1. Auth.login
 *   2. Product / Version / Build      -> crees s'ils n'existent pas
 *   3. TestPlan                       -> TCMS_PLAN_ID, sinon get-or-create
 *   4. TestRun                        -> TCMS_RUN_ID, sinon cree
 *   5. Pour chaque test :
 *        - TestCase get-or-create (titre du test = summary du cas)
 *        - ajout au plan + au run  -> TestExecution
 *        - statut PASSED / FAILED / WAIVED / ERROR / BLOCKED
 *        - commentaire : projet, fichier, duree, erreur, lien Allure
 *
 * Usage :
 *   node scripts/kiwi-report.mjs            # push reel
 *   node scripts/kiwi-report.mjs --dry-run  # affiche sans rien ecrire
 *   node scripts/kiwi-report.mjs --check    # teste la connexion a Kiwi
 */

import path from 'node:path';
import {
  CFG,
  ROOT,
  rpcCall,
  login,
  first,
  pickId,
  nowSql,
  ensureProduct,
  ensurePlan,
  caseDefaults,
  testCaseGetOrCreate,
  addCaseToPlan,
  readPlaywrightJson,
  filterProjects,
  cleanSummary,
  kiwiStatusName,
} from './kiwi-lib.mjs';

const ARGS = new Set(process.argv.slice(2));
const DRY_RUN = ARGS.has('--dry-run');
const CHECK_ONLY = ARGS.has('--check');

async function main() {
  console.log(`\n=== Playwright -> Kiwi TCMS (resultats) ===`);
  console.log(`Serveur : ${CFG.url}`);

  console.log(`Connecte en tant que : ${await login()}`);

  if (CHECK_ONLY) {
    const v = await rpcCall('KiwiTCMS.version', []).catch(() => 'inconnue');
    console.log(`Version Kiwi TCMS : ${v}`);
    console.log('Connexion OK.\n');
    return;
  }

  let tests;
  try {
    tests = filterProjects(readPlaywrightJson(CFG.resultsFile));
  } catch (e) {
    throw new Error(`${e.message}\nLance d'abord :  npm test`);
  }
  if (!tests.length) {
    console.log('Aucun test dans le rapport — rien a pousser.');
    return;
  }
  console.log(`${tests.length} test(s) lus depuis ${path.relative(ROOT, CFG.resultsFile)}`);

  if (DRY_RUN) {
    console.log('\n--- DRY RUN (aucune ecriture dans Kiwi) ---');
    for (const t of tests) console.log(`  [${kiwiStatusName(t)}] ${cleanSummary(t)}`);
    console.log('');
    return;
  }

  const { product, version, build } = await ensureProduct();
  const plan = await ensurePlan(product, version);

  let runId = CFG.runId;
  if (!runId) {
    const run = await rpcCall('TestRun.create', [
      {
        summary: `${CFG.prefix} ${CFG.product} — ${CFG.version} — ${CFG.build}`.slice(0, 255),
        manager: plan.author,
        default_tester: plan.author,
        plan: plan.id,
        build: build.id,
        start_date: nowSql(),
      },
    ]);
    runId = run.id;
    console.log(`TestRun cree : #${runId}`);
  } else {
    console.log(`TestRun existant reutilise : #${runId}`);
  }

  const defaults = await caseDefaults(product);

  const statusCache = new Map();
  async function statusId(name) {
    if (!statusCache.has(name)) {
      statusCache.set(name, await pickId('TestExecutionStatus', { name }));
    }
    return statusCache.get(name);
  }

  const tally = { PASSED: 0, FAILED: 0, WAIVED: 0, ERROR: 0, BLOCKED: 0 };

  for (const t of tests) {
    const { testCase, summary } = await testCaseGetOrCreate(t, product, defaults);
    await addCaseToPlan(plan.id, testCase.id);

    let executions;
    try {
      executions = await rpcCall('TestRun.add_case', [runId, testCase.id]);
    } catch {
      executions = await rpcCall('TestExecution.filter', [
        { run: runId, case: testCase.id },
      ]);
    }
    if (!Array.isArray(executions)) executions = [executions];
    if (!executions.length) {
      console.warn(`  ! Aucune TestExecution pour "${summary}" — ignore`);
      continue;
    }

    const name = kiwiStatusName(t);
    const sid = await statusId(name);
    const startMs = t.startTime ? Date.parse(t.startTime) : Date.now();
    const start = nowSql(startMs);
    const stop = nowSql(startMs + t.duration);

    const comment = [
      `Playwright — projet ${t.project || 'default'}`,
      `Fichier : ${t.file}${t.line ? ':' + t.line : ''}`,
      `Duree : ${(t.duration / 1000).toFixed(2)} s`,
      ...(CFG.allureUrl ? [`Rapport Allure : ${CFG.allureUrl}`] : []),
      ...(t.error ? ['', 'Erreur :', t.error.slice(0, 3000)] : []),
      ...(t.stdout ? ['', 'Sortie :', t.stdout] : []),
    ].join('\n');

    for (const ex of executions) {
      await rpcCall('TestExecution.update', [
        ex.id,
        { status: sid, start_date: start, stop_date: stop },
      ]);
      await rpcCall('TestExecution.add_comment', [ex.id, comment]);
    }

    tally[name] = (tally[name] || 0) + 1;
    console.log(`  [${name}] ${summary}`);
  }

  await rpcCall('TestRun.update', [runId, { stop_date: nowSql() }]).catch(() => {});

  const base = new URL(CFG.url).origin;
  console.log(`\nResultats pousses : ${JSON.stringify(tally)}`);
  console.log(`TestRun : ${base}/runs/${runId}/\n`);
}

main().catch((err) => {
  console.error(`\n[ERREUR] ${err.message}\n`);
  process.exit(1);
});
