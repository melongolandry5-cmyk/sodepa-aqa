#!/usr/bin/env node
/**
 * Pont Playwright -> Squash TM : pousse les RESULTATS d'execution.
 * ---------------------------------------------------------------------------
 * Pendant de `squash-sync-cases.mjs`, qui pousse le CATALOGUE des cas. Ce
 * script-ci publie ce qu'une campagne a donne :
 *
 *   1. Campagne              -> SQUASH_CAMPAIGN, creee si absente
 *   2. Iteration             -> une par execution (branche + commit + heure)
 *   3. Pour chaque test :
 *        - rapprochement avec le cas de test Squash, par nom
 *        - ajout au plan d'execution  -> item
 *        - ouverture d'une execution  -> statut READY
 *        - statut SUCCESS / FAILURE / UNTESTABLE + commentaire
 *          (module, fichier, duree, tentatives, erreur, lien Allure)
 *
 * La source est le rapport JSON de Playwright (`test-results/results.json`),
 * produit par le reporter `json` declare dans playwright.config.ts.
 *
 * Usage :
 *   node scripts/squash-push-results.mjs            # push reel
 *   node scripts/squash-push-results.mjs --dry-run  # affiche sans rien ecrire
 *   node scripts/squash-push-results.mjs --check    # verifie la connexion
 */

import path from 'node:path';
import {
  CFG,
  ROOT,
  api,
  apiRequestCount,
  probeApiRoot,
  hasCredentials,
  findProject,
  readPlaywrightJson,
  caseName,
  moduleOf,
  htmlEscape,
  ensureCampaign,
  createIteration,
  addTestPlanItem,
  createExecution,
  setExecutionResult,
  indexTestCasesByName,
  STATUT_SQUASH,
} from './squash-lib.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const check = args.includes('--check');
const fichierJson =
  process.env.PW_RESULTS_JSON || path.join(ROOT, 'test-results', 'results.json');

/** Nom de l'iteration : identifie l'execution sans ambiguite. */
function nomIteration() {
  if (CFG.iteration) return CFG.iteration;
  const horodatage = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const commit = CFG.commit ? ` ${CFG.commit}` : '';
  return `${CFG.branch}${commit} - ${horodatage}`;
}

/** Duree cumulee des tentatives, en secondes. */
function dureeSecondes(t) {
  const ms = (t.attempts || []).reduce((a, r) => a + (r.duration || 0), 0);
  return (ms / 1000).toFixed(1);
}

/** Commentaire de l'execution : ce qu'il faut pour diagnostiquer sans quitter Squash. */
function commentaire(t) {
  const lignes = [
    ['Module', moduleOf(t.file)],
    ['Fichier', `${t.file}:${t.line}`],
    ['Projet Playwright', t.project || '-'],
    ['Duree', `${dureeSecondes(t)} s`],
    ['Tentatives', String((t.attempts || []).length || 1)],
  ];
  if (CFG.commit) lignes.push(['Commit', `${CFG.branch} ${CFG.commit}`]);
  if (CFG.allureUrl) lignes.push(['Rapport Allure', CFG.allureUrl]);

  const tableau = lignes
    .map(([k, v]) => `<tr><td><strong>${htmlEscape(k)}</strong></td><td>${htmlEscape(v)}</td></tr>`)
    .join('');

  const erreurs = (t.attempts || [])
    .filter((r) => r.error)
    .map((r, i) => `<p><strong>Tentative ${i + 1}</strong></p><pre>${htmlEscape(String(r.error).slice(0, 1500))}</pre>`)
    .join('');

  const note =
    t.outcome === 'flaky'
      ? '<p><em>Test instable : une tentative a echoue avant que le test ne passe.</em></p>'
      : '';

  return `<table><tbody>${tableau}</tbody></table>${note}${erreurs}`;
}

async function main() {
  if (!hasCredentials()) {
    console.error(
      "Aucun identifiant Squash. Renseigne SQUASH_TOKEN dans .env\n" +
        '  (voir scripts/set-squash-token.ps1).'
    );
    process.exit(1);
  }

  await probeApiRoot();
  const projet = await findProject(CFG.project);
  if (!projet) {
    console.error(`Projet Squash introuvable : « ${CFG.project} ». Verifie SQUASH_PROJECT.`);
    process.exit(1);
  }
  console.log(`Squash    : ${CFG.project} (id ${projet.id})`);

  const tests = readPlaywrightJson(fichierJson).filter(
    (t) => !CFG.pwProject || t.project === CFG.pwProject
  );
  const joues = tests.filter((t) => t.outcome);
  if (!joues.length) {
    console.error(
      `Aucun resultat d'execution dans ${path.relative(ROOT, fichierJson)}.\n` +
        "  Ce fichier provient peut-etre d'un `playwright test --list` :\n" +
        '  relance une vraie campagne avant de publier.'
    );
    process.exit(1);
  }

  const index = await indexTestCasesByName(projet.id);
  const apparies = joues.filter((t) => index.has(caseName(t)));
  const orphelins = joues.filter((t) => !index.has(caseName(t)));

  console.log(`Resultats : ${joues.length} tests joues, ${apparies.length} rapproches d'un cas Squash`);
  if (orphelins.length) {
    console.log(`Orphelins : ${orphelins.length} sans cas correspondant — lance d'abord npm run squash:sync`);
    orphelins.slice(0, 5).forEach((t) => console.log(`  - ${caseName(t).slice(0, 90)}`));
  }

  if (check) {
    console.log(`\nConnexion et rapprochement OK (${apiRequestCount()} appels API).`);
    return;
  }

  const { campagne, created } = await ensureCampaign(CFG.campaign, projet, { dryRun });
  console.log(`Campagne  : ${campagne.name} (${created ? 'creee' : 'existante'})`);
  const iteration = await createIteration(campagne.id, nomIteration(), { dryRun });
  console.log(`Iteration : ${iteration.name}\n`);

  const compte = { SUCCESS: 0, FAILURE: 0, UNTESTABLE: 0 };
  let pousses = 0;

  for (const t of apparies) {
    const statut = STATUT_SQUASH[t.outcome] || 'BLOCKED';
    compte[statut] = (compte[statut] || 0) + 1;
    const nom = caseName(t);

    if (dryRun) {
      console.log(`  [simulation] ${statut.padEnd(11)} ${nom.slice(0, 80)}`);
      continue;
    }

    const cas = index.get(nom);
    try {
      const item = await addTestPlanItem(iteration.id, cas.id);
      const execution = await createExecution(item);
      await setExecutionResult(execution, statut, commentaire(t));
      pousses++;
      console.log(`  ${statut.padEnd(11)} ${(cas.reference || '').padEnd(12)} ${nom.slice(0, 70)}`);
    } catch (e) {
      console.error(`  ECHEC PUBLICATION ${nom.slice(0, 60)} -> ${String(e.message).slice(0, 160)}`);
    }
  }

  const resume = Object.entries(compte)
    .filter(([, n]) => n)
    .map(([s, n]) => `${s} ${n}`)
    .join(' | ');
  console.log(
    `\n${dryRun ? 'Simulation' : `${pousses} executions publiees`} — ${resume}` +
      ` (${apiRequestCount()} appels API)`
  );
  if (!dryRun && !CFG.allureUrl) {
    console.log(
      'Note : SQUASH_ALLURE_URL est vide, les executions ne portent pas de lien vers le rapport.'
    );
  }
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
