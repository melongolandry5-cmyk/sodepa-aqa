#!/usr/bin/env node
/**
 * Garde-fou de la conversion des specs en scenarios rediges.
 * ---------------------------------------------------------------------------
 * Les cas Squash sont rapproches par le NOM du test : un titre modifie casse le
 * lien avec l'historique d'execution. Ce script compare donc les titres du
 * fichier de travail a ceux de la reference git, et signale au passage les
 * tests qui n'ont pas encore de scenario redige.
 *
 * Usage :
 *   node scripts/check-scenarios.mjs                  # tout le dossier api/
 *   node scripts/check-scenarios.mjs api/audit        # un module
 *   node scripts/check-scenarios.mjs --ref HEAD~1     # autre reference git
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenarioSteps, scenarioContext } from './scenario-parse.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const refIndex = argv.indexOf('--ref');
const REF = refIndex !== -1 && argv[refIndex + 1] ? argv[refIndex + 1] : 'HEAD';
const cible = argv.find((a) => !a.startsWith('--') && a !== REF) || 'api';

/** Titres des tests d'un fichier, dans l'ordre. */
function titres(source) {
  const re = /(?:^|\n)\s*test(?:\.skip|\.only|\.fixme)?\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  const out = [];
  let m;
  while ((m = re.exec(source))) out.push(m[2]);
  return out;
}

/** Corps de chaque test, pour mesurer la couverture des scenarios. */
function corpsDesTests(source) {
  const bornes = [];
  const re = /(?:^|\n)(\s*)test(?:\.skip|\.only|\.fixme)?\(\s*(['"`])((?:\\.|(?!\2)[\s\S])*?)\2/g;
  let m;
  while ((m = re.exec(source))) bornes.push({ titre: m[3], debut: m.index });
  return bornes.map((b, i) => ({
    titre: b.titre,
    corps: source.slice(b.debut, i + 1 < bornes.length ? bornes[i + 1].debut : source.length),
  }));
}

function fichiers(dir) {
  const abs = path.resolve(ROOT, dir);
  if (fs.statSync(abs).isFile()) return [abs];
  const out = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const p = path.join(abs, e.name);
    if (e.isDirectory()) out.push(...fichiers(p));
    else if (/\.spec\.ts$/.test(e.name)) out.push(p);
  }
  return out.sort();
}

let divergences = 0;
let totalTests = 0;
let avecScenario = 0;
let sansContexte = 0;

for (const abs of fichiers(cible)) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const actuel = fs.readFileSync(abs, 'utf8');

  let reference = null;
  try {
    reference = execSync(`git show ${REF}:${rel}`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1e8 });
  } catch {
    // fichier absent de la reference : rien a comparer
  }

  if (reference) {
    const a = titres(reference);
    const b = titres(actuel);
    if (a.length !== b.length || a.some((x, i) => x !== b[i])) {
      divergences++;
      console.log(`x ${rel}`);
      console.log(`  ${a.length} titre(s) en reference, ${b.length} maintenant`);
      a.filter((x) => !b.includes(x)).forEach((x) => console.log(`  - disparu : ${x}`));
      b.filter((x) => !a.includes(x)).forEach((x) => console.log(`  + apparu  : ${x}`));
    }
  }

  const tests = corpsDesTests(actuel);
  totalTests += tests.length;
  for (const t of tests) {
    const etapes = scenarioSteps(t.corps);
    if (etapes.length) avecScenario++;
    const { preconditions, configuration } = scenarioContext(t.corps);
    if (!preconditions.length && !configuration.length) sansContexte++;
  }
}

console.log('--------------------------------------------------');
console.log(`  ${totalTests} test(s) inspecte(s) sous ${cible}`);
console.log(`  ${avecScenario} avec scenario redige, ${totalTests - avecScenario} sans`);
console.log(`  ${sansContexte} sans precondition ni configuration`);
if (divergences) {
  console.log(`  ${divergences} fichier(s) dont les titres ont change — a corriger`);
  process.exit(1);
}
console.log('  titres identiques a la reference');
