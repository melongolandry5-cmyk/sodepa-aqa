#!/usr/bin/env node
/**
 * Renumerote la REFERENCE des cas de test Squash TM deja crees.
 * ---------------------------------------------------------------------------
 * squash-sync-cases.mjs donne a chaque cas une reference stable mais illisible
 * (PW-XXXXXXXXXX, hash du chemin + titre). Ce script la remplace par un
 * identifiant sequentiel et lisible :
 *
 *     TC-<code module>-<numero sur 4 chiffres>      ex. TC-AU-0001
 *
 * Les cas sont numerotes dans l'ordre ou Squash les restitue (dossier
 * "module" -> sous-dossiers "fichier" tries par nom -> cas dans l'ordre de
 * l'API), ce qui correspond a l'ordre de creation d'origine.
 *
 * Ne touche a rien d'autre que le champ "reference" : nom, etapes,
 * description, importance, statut, champs d'automatisation... restent
 * inchanges. Le script ne fait AUCUNE ecriture tant que --apply n'est pas
 * passe explicitement.
 *
 * Idempotent : si un cas a deja la reference calculee, il est ignore (aucun
 * appel PATCH). On peut donc relancer le script sans risque apres l'ajout de
 * nouveaux tests -- attention cependant, le calcul repart de 0001 a chaque
 * execution en suivant l'ordre courant : si l'ordre des cas dans Squash a
 * change (deplacement manuel, reorganisation), la numerotation peut se
 * decaler. Verifie toujours le plan (fichier --out) avant --apply.
 *
 * Usage :
 *   node scripts/squash-renumber-ids.mjs                       # simulation, ecrit le plan, rien n'est modifie dans Squash
 *   node scripts/squash-renumber-ids.mjs --apply                # applique reellement les changements
 *   node scripts/squash-renumber-ids.mjs --module audit --apply # un seul module
 *   node scripts/squash-renumber-ids.mjs --out plan.json         # change le nom du fichier plan
 *
 * Configuration : meme .env que squash-sync-cases.mjs (SQUASH_URL, SQUASH_USER,
 * SQUASH_TOKEN/SQUASH_PASSWORD, SQUASH_PROJECT, SQUASH_ROOT_FOLDER).
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  CFG,
  ROOT,
  api,
  apiRequestCount,
  findProject,
  probeApiRoot,
  containerContent,
  hasCredentials,
} from './squash-lib.mjs';

/* ---------------------------------------------------------------- arguments */

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const APPLY = argv.includes('--apply');
const DRY_RUN = !APPLY;
const MODULE = flag('--module');
const OUT = flag('--out') || 'squash-renumber-plan.json';

/* ---------------------------------------------------------- codes de module */

// Deux lettres par module. Codes choisis a la main (pas juste les 2 premieres
// lettres du nom) pour eviter les collisions : "audit"/"authentication" et
// "comptabilite_analytique"/"comptabilite_generale" partagent sinon le meme
// prefixe. Ajoute une entree ici si un nouveau module apparait -- le script
// s'arrete avec un message clair s'il en manque une.
const MODULE_CODES = {
  audit: 'AU',
  authentication: 'AT',
  budget: 'BU',
  comptabilite_analytique: 'CA',
  comptabilite_generale: 'CG',
  financement: 'FI',
  system_core: 'SC',
  tresorerie: 'TR',
  user_management: 'UM',
};

function codeFor(moduleName) {
  const code = MODULE_CODES[moduleName];
  if (!code) {
    throw new Error(
      `Aucun code a 2 lettres defini pour le module "${moduleName}" dans ` +
        `MODULE_CODES (en haut de scripts/squash-renumber-ids.mjs).\n` +
        `Ajoute-le puis relance.`
    );
  }
  return code;
}

/* ------------------------------------------------------------- arborescence */

async function findRootFolder(project) {
  const items = await containerContent({ _type: 'project', id: project.id });
  const root = items.find(
    (e) => e._type === 'test-case-folder' && String(e.name).trim() === CFG.rootFolder.trim()
  );
  if (!root) {
    throw new Error(
      `Dossier racine "${CFG.rootFolder}" introuvable dans le projet "${project.name}".\n` +
        `Lance d'abord squash-sync-cases.mjs, ou verifie SQUASH_ROOT_FOLDER dans .env.`
    );
  }
  return { _type: 'test-case-folder', id: root.id, name: root.name };
}

async function listModuleFolders(root) {
  const items = await containerContent(root);
  return items
    .filter((e) => e._type === 'test-case-folder')
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/** Cas de test d'un dossier, recursivement, dans un ordre stable. */
async function collectCases(folder) {
  const items = await containerContent(folder);
  const cases = items.filter((e) => e._type === 'test-case');
  const subfolders = items
    .filter((e) => e._type === 'test-case-folder')
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  for (const sf of subfolders) {
    const child = await collectCases({ _type: 'test-case-folder', id: sf.id, name: sf.name });
    cases.push(...child);
  }
  return cases;
}

/* ------------------------------------------------------------- mise a jour */

/**
 * Modifie la reference d'un cas. Tente d'abord un PATCH partiel (standard
 * pour l'API REST Squash TM) ; si cette instance ne l'accepte pas (404/405/
 * 501), repli sur un GET + PUT de la ressource complete.
 */
async function updateReference(id, newRef) {
  try {
    return await api('PATCH', `/test-cases/${id}`, { _type: 'test-case', reference: newRef });
  } catch (e) {
    if (e.status === 404 || e.status === 405 || e.status === 501) {
      const full = await api('GET', `/test-cases/${id}`);
      return await api('PUT', `/test-cases/${id}`, { ...full, reference: newRef });
    }
    throw e;
  }
}

/* ---------------------------------------------------------------------- main */

async function main() {
  console.log('\n=== Renumerotation des references Squash TM ===');
  console.log(`Serveur : ${CFG.url}`);
  console.log(`Projet  : ${CFG.project}`);
  console.log(`Racine  : ${CFG.rootFolder}`);
  console.log(DRY_RUN ? 'Mode    : SIMULATION (--apply pour ecrire)' : 'Mode    : ECRITURE REELLE');

  if (!hasCredentials()) {
    throw new Error("Aucun identifiant dans .env (SQUASH_TOKEN ou SQUASH_PASSWORD).");
  }

  await probeApiRoot();
  const project = await findProject(CFG.project);
  console.log(`\nProjet trouve : #${project.id} ${project.name}`);

  const root = await findRootFolder(project);
  let modules = await listModuleFolders(root);
  if (MODULE) modules = modules.filter((m) => m.name === MODULE);
  if (!modules.length) {
    console.log('Aucun module trouve — rien a faire.');
    return;
  }

  console.log(`\nCodes de module utilises :`);
  for (const mod of modules) {
    console.log(`  ${mod.name.padEnd(26)} -> ${codeFor(mod.name)}`);
  }

  const plan = [];
  console.log('');
  for (const mod of modules) {
    const code = codeFor(mod.name);
    const cases = await collectCases({ _type: 'test-case-folder', id: mod.id, name: mod.name });
    let n = 0;
    for (const c of cases) {
      n++;
      const newRef = `TC-${code}-${String(n).padStart(4, '0')}`;
      plan.push({ module: mod.name, id: c.id, name: c.name, oldRef: c.reference || '', newRef });
    }
    const last = `TC-${code}-${String(cases.length).padStart(4, '0')}`;
    console.log(
      `  ${mod.name.padEnd(26)} ${String(cases.length).padStart(4)} cas -> TC-${code}-0001..${last.split('-').pop()}`
    );
  }

  fs.writeFileSync(path.resolve(ROOT, OUT), JSON.stringify(plan, null, 2), 'utf8');
  console.log(`\nPlan ecrit dans ${OUT} (${plan.length} cas).`);

  const changed = plan.filter((p) => p.oldRef !== p.newRef);
  console.log(`${changed.length} reference(s) a modifier, ${plan.length - changed.length} deja a jour.`);

  if (changed.length) {
    console.log('\nApercu (10 premiers changements) :');
    for (const p of changed.slice(0, 10)) {
      console.log(`  #${p.id}  ${(p.oldRef || '(vide)').padEnd(14)} ->  ${p.newRef}   ${p.name.slice(0, 60)}`);
    }
  }

  if (DRY_RUN) {
    console.log(`\nSimulation seule : relis ${OUT}, puis relance avec --apply pour ecrire dans Squash.`);
    return;
  }

  let done = 0;
  let failed = 0;
  for (const p of changed) {
    try {
      await updateReference(p.id, p.newRef);
      done++;
      console.log(`  + #${p.id}  ${(p.oldRef || '(vide)')} -> ${p.newRef}`);
    } catch (e) {
      failed++;
      console.log(`  x ECHEC #${p.id} (${p.oldRef || '(vide)'} -> ${p.newRef})`);
      console.log(`    ${e.message.slice(0, 300)}`);
      if (failed >= 5) {
        throw new Error(
          `${failed} echecs — arret. Le plan dans ${OUT} liste ce qu'il reste a faire ; ` +
            `corrige la cause puis relance (le script est idempotent, ce qui est deja ` +
            `renomme ne sera pas retouche).`
        );
      }
    }
  }

  console.log('\n--------------------------------------------------');
  console.log(`  ${done} reference(s) mise(s) a jour`);
  console.log(`  ${plan.length - changed.length} deja a jour, ignoree(s)`);
  if (failed) console.log(`  ${failed} en echec`);
  console.log(`  ${apiRequestCount()} appel(s) API`);
  console.log('--------------------------------------------------\n');
}

main().catch((err) => {
  console.error(`\n[ERREUR] ${err.message}\n`);
  process.exit(1);
});
