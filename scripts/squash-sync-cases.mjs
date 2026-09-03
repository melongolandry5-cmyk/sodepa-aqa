#!/usr/bin/env node
/**
 * Synchronise le CATALOGUE des tests Playwright vers Squash TM.
 * ---------------------------------------------------------------------------
 * Le script n'execute AUCUN test : il inventorie les cas via
 * `playwright test --list` et cree dans Squash l'arborescence
 *
 *     <projet Squash>
 *       └─ Playwright API           (SQUASH_ROOT_FOLDER)
 *            └─ <module>            api/<module>/...
 *                 └─ <fichier>      <nom>.spec.ts
 *                      └─ cas de test
 *
 * Chaque cas porte :
 *   - un nom = chaine des test.describe() + titre du test ;
 *   - une reference stable PW-XXXXXXXXXX (empreinte du chemin + titre), qui
 *     survit au renommage et sert de cle d'idempotence ;
 *   - des etapes deduites du code (ou les test.step() quand ils existent) ;
 *   - la commande pour rejouer le test seul, en prerequis ;
 *   - la reference technique du script automatise.
 *
 * Usage :
 *   node scripts/squash-sync-cases.mjs --dry-run          # simulation, rien n'est ecrit
 *   node scripts/squash-sync-cases.mjs --module audit     # un seul module
 *   node scripts/squash-sync-cases.mjs                    # tout le projet api
 *   node scripts/squash-sync-cases.mjs --out plan.json    # exporte le plan sans ecrire
 *   node scripts/squash-sync-cases.mjs --from liste.json  # repart d'un JSON deja produit
 *
 * Configuration : .env a la racine du depot
 *   SQUASH_URL=http://localhost:8090/api/rest/latest
 *   SQUASH_USER=admin
 *   SQUASH_TOKEN=...            (ou SQUASH_PASSWORD=...)
 *   SQUASH_PROJECT=erp sodepa
 *   SQUASH_ROOT_FOLDER=Playwright API
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CFG,
  ROOT,
  api,
  apiRequestCount,
  findProject,
  probeApiRoot,
  containerContent,
  hasCredentials,
  ensureFolder,
  readPlaywrightJson,
  moduleOf,
  specNameOf,
  caseName,
  caseReference,
  extractTestBody,
  deriveSteps,
  buildPrerequisite,
  buildDescription,
  updateTestCaseContent,
  automatedReference,
} from './squash-lib.mjs';

/* ---------------------------------------------------------------- arguments */

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const DRY_RUN = argv.includes('--dry-run');
const MODULE = flag('--module');
const GREP = flag('--grep');
const FROM = flag('--from');
const OUT = flag('--out');
// Rafraichit le contenu redactionnel des cas deja presents (etapes, prerequis).
const UPDATE = argv.includes('--update');
const LIMIT = flag('--limit') ? Number(flag('--limit')) : 0;
const STEP_MODE = argv.includes('--raw-steps') ? 'raw' : 'derived';

/* ------------------------------------------------- liste des tests Playwright */

function listTests() {
  if (FROM) return readPlaywrightJson(path.resolve(ROOT, FROM));

  const out = path.join(os.tmpdir(), `pw-list-squash-${process.pid}.json`);
  const args = ['playwright', 'test', '--list', '--reporter=json', '--project', CFG.pwProject];
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

/* --------------------------------------------------------- payload d'un cas */

function buildPayload(t, parentFolder) {
  const body = extractTestBody(t.file, t.line);
  const { steps, skips, source } = deriveSteps(body, { mode: STEP_MODE });

  const payload = {
    _type: 'test-case',
    name: caseName(t),
    reference: caseReference(t),
    parent: { _type: parentFolder._type, id: parentFolder.id },
    importance: CFG.importance,
    status: CFG.status,
    description: buildDescription(t, source),
    prerequisite: buildPrerequisite(t, skips, body),
    steps: steps.map((s) => ({
      _type: 'action-step',
      action: s.action,
      expected_result: s.expected_result || '',
    })),
  };
  if (CFG.natureCode) payload.nature = { code: CFG.natureCode };
  if (CFG.typeCode) payload.type = { code: CFG.typeCode };
  return payload;
}

function withAutomation(payload, t) {
  return {
    ...payload,
    automatable: 'Y',
    automated_test_technology: CFG.technology,
    automated_test_reference: automatedReference(t),
  };
}

/* ---------------------------------------------------------------------- main */

async function main() {
  console.log('\n=== Catalogue Playwright -> Squash TM ===');
  console.log(`Serveur : ${CFG.url}`);
  console.log(`Projet  : ${CFG.project}`);
  console.log(`Racine  : ${CFG.rootFolder}`);
  if (DRY_RUN) console.log('Mode    : SIMULATION (aucune ecriture dans Squash)');

  let tests = listTests();
  if (MODULE) tests = tests.filter((t) => moduleOf(t.file) === MODULE);
  if (LIMIT > 0) tests = tests.slice(0, LIMIT);

  if (!tests.length) {
    console.log('Aucun test trouve — rien a synchroniser.');
    return;
  }

  // Regroupement module -> fichier -> tests, dans un ordre stable.
  const tree = new Map();
  for (const t of tests) {
    const mod = moduleOf(t.file);
    const spec = specNameOf(t.file);
    if (!tree.has(mod)) tree.set(mod, new Map());
    const bySpec = tree.get(mod);
    if (!bySpec.has(spec)) bySpec.set(spec, []);
    bySpec.get(spec).push(t);
  }

  console.log(`\n${tests.length} test(s) inventorie(s) dans ${tree.size} module(s) :`);
  for (const [mod, specs] of [...tree].sort()) {
    const n = [...specs.values()].reduce((a, v) => a + v.length, 0);
    console.log(`  ${mod.padEnd(26)} ${String(n).padStart(4)} test(s) / ${specs.size} fichier(s)`);
  }

  if (OUT) {
    const plan = [];
    for (const [mod, specs] of tree) {
      for (const [spec, list] of specs) {
        for (const t of list) {
          plan.push({
            module: mod,
            fichier: spec,
            ...buildPayload(t, { _type: 'test-case-folder', id: 0 }),
          });
        }
      }
    }
    fs.writeFileSync(path.resolve(ROOT, OUT), JSON.stringify(plan, null, 2), 'utf8');
    console.log(`\nPlan ecrit dans ${OUT} (${plan.length} cas). Aucune ecriture dans Squash.`);
    return;
  }

  const simulationAveugle = DRY_RUN && !hasCredentials();
  if (simulationAveugle) {
    console.log(
      "\nAucun identifiant dans .env : la simulation n'interroge pas le serveur\n" +
        '  et considere que tout est a creer.'
    );
  }

  if (!simulationAveugle) await probeApiRoot();

  const project = simulationAveugle
    ? { id: 0, name: CFG.project }
    : await findProject(CFG.project);
  if (!simulationAveugle) console.log(`\nProjet trouve : #${project.id} ${project.name}`);

  const cache = new Map();
  const projectNode = { _type: 'project', id: project.id };

  const { folder: root, created: rootCreated } = await ensureFolder(
    CFG.rootFolder, projectNode, cache, { dryRun: DRY_RUN }
  );
  console.log(`${rootCreated ? '+ cree  ' : '= existe'} dossier racine « ${CFG.rootFolder} »`);

  let createdCases = 0;
  let existingCases = 0;
  let updatedCases = 0;
  let failed = 0;
  let automationOk = CFG.automationFields !== 'off';

  for (const [mod, specs] of [...tree].sort()) {
    const { folder: modFolder, created: modNew } = await ensureFolder(
      mod, root, cache, { dryRun: DRY_RUN }
    );
    console.log(`\n${modNew ? '+ cree  ' : '= existe'} module « ${mod} »`);

    for (const [spec, list] of [...specs].sort()) {
      const { folder: specFolder, created: specNew } = await ensureFolder(
        spec, modFolder, cache, { dryRun: DRY_RUN }
      );
      console.log(`  ${specNew ? '+ cree  ' : '= existe'} fichier « ${spec} » (${list.length} cas)`);

      // Cas deja presents dans ce dossier : on indexe par reference puis par nom.
      let present = new Map();
      if (!DRY_RUN && !specNew) {
        for (const e of await containerContent(specFolder)) {
          if (e._type && String(e._type).includes('test-case')) {
            if (e.reference) present.set('ref:' + e.reference, e);
            present.set('nom:' + e.name, e);
          }
        }
      }

      for (const t of list) {
        const ref = caseReference(t);
        const nom = caseName(t);
        const deja = present.get('ref:' + ref) || present.get('nom:' + nom);
        if (deja) {
          existingCases++;
          if (!UPDATE || DRY_RUN) continue;
          try {
            const base = buildPayload(t, specFolder);
            const bilan = await updateTestCaseContent(deja.id, base);
            updatedCases++;
            console.log(
              `      ~ #${deja.id} ${ref}  ${nom.slice(0, 70)} (${bilan.ajoutees} etape(s))`
            );
          } catch (e) {
            failed++;
            console.log(`      x MAJ ECHOUEE ${ref} -> ${String(e.message).slice(0, 160)}`);
          }
          continue;
        }

        const base = buildPayload(t, specFolder);
        if (DRY_RUN) {
          createdCases++;
          console.log(`      + ${ref}  ${nom.slice(0, 90)}`);
          continue;
        }

        try {
          let created;
          if (automationOk) {
            try {
              created = await api('POST', '/test-cases', withAutomation(base, t));
            } catch (e) {
              if (e.status === 400 || e.status === 422 || e.status === 412) {
                // L'instance refuse les champs d'automatisation (fonctionnalite
                // desactivee ou technologie inconnue) : on repasse sans eux.
                console.log(
                  `      ! champs d'automatisation refuses (${e.status}), bascule en mode degrade`
                );
                automationOk = false;
                created = await api('POST', '/test-cases', base);
              } else throw e;
            }
          } else {
            created = await api('POST', '/test-cases', base);
          }
          createdCases++;
          console.log(`      + #${created.id} ${ref}  ${nom.slice(0, 80)}`);
        } catch (e) {
          failed++;
          console.log(`      x ECHEC ${ref}  ${nom.slice(0, 60)}`);
          console.log(`        ${e.message.slice(0, 300)}`);
          if (failed >= 5) {
            throw new Error(
              `${failed} echecs consecutifs — arret. Corrige la cause avant de relancer ` +
                `(le script est idempotent, les cas deja crees ne seront pas dupliques).`
            );
          }
        }
      }
    }
  }

  console.log('\n--------------------------------------------------');
  console.log(`  ${createdCases} cas ${DRY_RUN ? 'a creer' : 'cree(s)'}`);
  console.log(
    `  ${existingCases} deja present(s)` + (UPDATE ? `, dont ${updatedCases} mis a jour` : ', ignore(s)')
  );
  if (failed) console.log(`  ${failed} en echec`);
  if (!DRY_RUN && !automationOk && CFG.automationFields !== 'off') {
    console.log(
      "  Champs d'automatisation non appliques : active « Serveurs d'execution\n" +
        '  automatisee » dans Squash puis relance, ou ignore si tu n\'en as pas besoin.'
    );
  }
  console.log(`  ${apiRequestCount()} appel(s) API`);
  console.log('--------------------------------------------------\n');
}

main().catch((err) => {
  console.error(`\n[ERREUR] ${err.message}\n`);
  process.exit(1);
});
