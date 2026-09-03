#!/usr/bin/env node
/**
 * Genere le rapport Allure en fichier unique, partageable tel quel.
 * ---------------------------------------------------------------------------
 * `allure generate --single-file` produit un seul index.html qui embarque le
 * bundle, les donnees et les pieces jointes. Deux retouches ensuite :
 *
 *  - le bundle Allure 2 embarque un mouchard Google Analytics ; un rapport
 *    destine a circuler ne doit pas appeler un tiers a l'ouverture, et le
 *    drapeau -Dallure.analytics.enabled=false n'a aucun effet dessus ;
 *  - on verifie qu'il ne reste aucune reference reseau, sans quoi le fichier
 *    ne serait pas reellement autonome.
 *
 * Usage :
 *   node scripts/allure-report.mjs                 # allure-results -> allure-report/index.html
 *   node scripts/allure-report.mjs --open          # ouvre le fichier a la fin
 *   node scripts/allure-report.mjs --results X --out Y
 */

import { spawnSync } from 'node:child_process';
import allureCommandline from 'allure-commandline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valeur = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i !== -1 && args[i + 1] ? args[i + 1] : defaut;
};

const resultats = path.resolve(ROOT, valeur('--results', 'allure-results'));
const sortie = path.resolve(ROOT, valeur('--out', 'allure-report'));
const ouvrir = args.includes('--open');

if (!fs.existsSync(resultats)) {
  console.error(
    `Aucun resultat Allure dans ${path.relative(ROOT, resultats)}.\n` +
      '  Lance une campagne avant : npm test'
  );
  process.exit(1);
}

/**
 * Allure tourne sur la JVM. Sans JAVA_HOME ni `java` dans le PATH, il echoue
 * avec un message peu parlant : on cherche donc une installation courante
 * avant de renoncer, plutot que d'imposer une variable d'environnement.
 */
function resoudreJava() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  const ouSeTrouve = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['java'], {
    encoding: 'utf8',
  });
  if (ouSeTrouve.status === 0) return null; // java est dans le PATH, rien a forcer

  const bases =
    process.platform === 'win32'
      ? ['C:/Program Files/Eclipse Adoptium', 'C:/Program Files/Java', 'C:/Program Files/Microsoft']
      : ['/usr/lib/jvm', '/Library/Java/JavaVirtualMachines'];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    for (const entree of fs.readdirSync(base).sort().reverse()) {
      const candidat = path.join(base, entree);
      const bin = path.join(candidat, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
      if (fs.existsSync(bin)) return candidat;
      // installations macOS : <version>/Contents/Home
      const home = path.join(candidat, 'Contents', 'Home');
      if (fs.existsSync(path.join(home, 'bin', 'java'))) return home;
    }
  }
  return null;
}

const javaHome = resoudreJava();
if (javaHome) process.env.JAVA_HOME = javaHome;

// `allure-commandline` expose une API JS qui gere elle-meme le lancement selon
// la plateforme : sous Windows, Node refuse de spawner un .cmd directement
// (EINVAL), et les chemins du depot contiennent des espaces.
const generation = allureCommandline([
  'generate',
  resultats,
  '--clean',
  '--single-file',
  '-o',
  sortie,
]);
const code = await new Promise((resolve) => generation.on('exit', resolve));
if (code !== 0) {
  [
      '',
      'Echec de la generation. Allure a besoin de Java 17 ou superieur.',
      javaHome
        ? `  JAVA_HOME utilise : ${javaHome}`
        : '  Aucune installation trouvee : installe un JDK ou renseigne JAVA_HOME.',
    ].forEach((l) => console.error(l));
  process.exit(code || 1);
}

const fichier = path.join(sortie, 'index.html');
if (!fs.existsSync(fichier)) {
  console.error(`Generation terminee mais ${path.relative(ROOT, fichier)} est absent.`);
  process.exit(1);
}

let html = fs.readFileSync(fichier, 'utf8');
const avant = html.length;

// mouchard : la balise externe, puis le bloc inline qui l'initialise
html = html.replace(/\s*<script[^>]*src="https?:\/\/www\.googletagmanager\.com[^"]*"[^>]*>\s*<\/script>/gi, '');
html = html.replace(/\s*<script>[^<]*gtag\([^<]*<\/script>/gi, '');

const restantes = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]);
fs.writeFileSync(fichier, html);

const mo = (fs.statSync(fichier).size / 1024 / 1024).toFixed(1);
console.log(`\nRapport partageable : ${path.relative(ROOT, fichier)} (${mo} Mo, fichier unique)`);
console.log(`Mouchard retire     : ${avant - html.length} octets`);
if (restantes.length) {
  console.log(`ATTENTION : ${restantes.length} reference(s) reseau subsistent :`);
  [...new Set(restantes)].slice(0, 5).forEach((u) => console.log(`  - ${u}`));
} else {
  console.log('Autonomie           : aucune reference reseau, le fichier s ouvre hors ligne');
}

if (ouvrir) {
  const cmd = process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawnSync(cmd, [fichier], { stdio: 'ignore', detached: true });
}
