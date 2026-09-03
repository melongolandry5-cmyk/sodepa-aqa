#!/usr/bin/env node
/**
 * Synchronise le CATALOGUE des tests Playwright vers Kiwi TCMS.
 * ---------------------------------------------------------------------------
 * Contrairement a kiwi-report.mjs, ce script n'execute AUCUN test et ne cree
 * aucun Test Run : il liste les tests (`playwright test --list`) et cree dans
 * Kiwi les Test Cases correspondants, rattaches a un Test Plan.
 *
 * A utiliser quand on veut peupler Kiwi avec les cas automatises avant meme
 * de lancer une campagne (revue des cas, assignation, tracabilite).
 *
 * Usage :
 *   node scripts/kiwi-sync-cases.mjs                    # tous les projets
 *   node scripts/kiwi-sync-cases.mjs --project api      # un seul projet
 *   node scripts/kiwi-sync-cases.mjs --grep @smoke      # filtre par tag
 *   node scripts/kiwi-sync-cases.mjs --dry-run          # simulation
 *   node scripts/kiwi-sync-cases.mjs --from fichier.json  # JSON deja produit
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CFG,
  ROOT,
  login,
  ensureProduct,
  ensurePlan,
  caseDefaults,
  testCaseGetOrCreate,
  addCaseToPlan,
  readPlaywrightJson,
  filterProjects,
  cleanSummary,
} from './kiwi-lib.mjs';

/* ---------------------------------------------------------------- arguments */

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const DRY_RUN = argv.includes('--dry-run');
const PROJECT = flag('--project');
const GREP = flag('--grep');
const FROM = flag('--from');

/* ------------------------------------------------- liste des tests Playwright */

function listTests() {
  if (FROM) return readPlaywrightJson(path.resolve(ROOT, FROM));

  const out = path.join(os.tmpdir(), `pw-list-${process.pid}.json`);
  const args = ['playwright', 'test', '--list', '--reporter=json'];
  if (PROJECT) args.push('--project', PROJECT);
  if (GREP) args.push('--grep', GREP);

  console.log(`Inventaire des tests : npx ${args.join(' ')}`);
  const res = spawnSync('npx', args, {
    cwd: ROOT,
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: out },
    encoding: 'utf8',
    shell: process.platform === 'win32', // npx.cmd sous Windows
  });

  if (!fs.existsSync(out)) {
    throw new Error(
      `Playwright n'a pas produit de liste JSON.\n${(res.stderr || res.stdout || '').slice(0, 800)}`
    );
  }
  const tests = readPlaywrightJson(out);
  fs.unlinkSync(out);
  return tests;
}

/* ---------------------------------------------------------------------- main */

async function main() {
  console.log(`\n=== Catalogue Playwright -> Kiwi TCMS (Test Cases) ===`);
  console.log(`Serveur : ${CFG.url}`);

  const tests = filterProjects(listTests());
  if (!tests.length) {
    console.log('Aucun test trouve — rien a synchroniser.');
    return;
  }
  console.log(`${tests.length} test(s) inventorie(s)\n`);

  if (DRY_RUN) {
    console.log('--- DRY RUN (aucune ecriture dans Kiwi) ---');
    for (const t of tests) console.log(`  ${cleanSummary(t)}`);
    console.log('');
    return;
  }

  console.log(`Connecte en tant que : ${await login()}`);

  const { product, version } = await ensureProduct({ withBuild: false });
  const plan = await ensurePlan(product, version);
  const defaults = await caseDefaults(product);

  let created = 0;
  let existing = 0;

  for (const t of tests) {
    const { testCase, created: isNew, summary } = await testCaseGetOrCreate(
      t,
      product,
      defaults
    );
    await addCaseToPlan(plan.id, testCase.id);
    if (isNew) created++;
    else existing++;
    console.log(`  ${isNew ? '+ cree  ' : '= existe'} #${testCase.id}  ${summary}`);
  }

  const base = new URL(CFG.url).origin;
  console.log(`\n${created} cas cree(s), ${existing} deja present(s).`);
  console.log(`Test Plan : ${base}/plan/${plan.id}/\n`);
}

main().catch((err) => {
  console.error(`\n[ERREUR] ${err.message}\n`);
  process.exit(1);
});
