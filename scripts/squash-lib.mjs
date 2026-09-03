/**
 * Socle commun des scripts Squash TM.
 * ---------------------------------------------------------------------------
 * Zero dependance npm : uniquement des modules Node natifs.
 *
 * - lecture du .env
 * - client REST minimal (authentification Basic : mot de passe ou jeton d'API)
 * - helpers Squash (Projet / Dossiers / Cas de test)
 * - lecture du JSON Playwright (sortie de `playwright test --list`)
 * - extraction des etapes depuis le code source des specs
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnv();

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
  url: process.env.SQUASH_URL || 'http://localhost:8090/api/rest/latest',
  user: process.env.SQUASH_USER || 'admin',
  // Deux schemas d'authentification distincts :
  //  - jeton personnel  -> en-tete « Bearer <jeton> »  (recommande, et seul
  //    schema accepte quand squash.rest-api.disallow-basic-authentication=true,
  //    ce qui est le defaut a partir de Squash TM 15) ;
  //  - mot de passe     -> en-tete « Basic <base64> ».
  token: process.env.SQUASH_TOKEN || '',
  password: process.env.SQUASH_PASSWORD || '',
  project: process.env.SQUASH_PROJECT || 'erp sodepa',
  rootFolder: process.env.SQUASH_ROOT_FOLDER || 'Playwright API',
  pwProject: process.env.SQUASH_PW_PROJECT || 'api',

  // Champs metier du cas de test. Laisser vide pour garder les valeurs par
  // defaut du projet Squash (les codes de nature/type dependent des listes
  // personnalisees, un code inconnu provoquerait un HTTP 400).
  importance: process.env.SQUASH_IMPORTANCE || 'MEDIUM',
  status: process.env.SQUASH_STATUS || 'WORK_IN_PROGRESS',
  natureCode: process.env.SQUASH_NATURE || '',
  typeCode: process.env.SQUASH_TYPE || '',

  // Champs d'automatisation. Squash les ignore ou les refuse quand la
  // fonctionnalite "Serveurs d'execution automatisee" est desactivee :
  // le script bascule alors automatiquement en mode degrade.
  automationFields: (process.env.SQUASH_AUTOMATION_FIELDS || 'auto').toLowerCase(),
  technology: process.env.SQUASH_AUTOMATED_TECHNOLOGY || 'Playwright',

  // Publication des resultats d'execution (scripts/squash-push-results.mjs).
  campaign: process.env.SQUASH_CAMPAIGN || process.env.SQUASH_ROOT_FOLDER || 'Playwright API',
  // Vide : le nom de l'iteration est derive de la branche, du commit et de l'heure.
  iteration: process.env.SQUASH_ITERATION || '',
  // URL du rapport Allure publie, reportee en commentaire de chaque execution.
  allureUrl: process.env.SQUASH_ALLURE_URL || '',

  branch: process.env.SQUASH_BRANCH || git('rev-parse --abbrev-ref HEAD', 'local'),
  commit: git('rev-parse --short HEAD', ''),
  repoUrl: process.env.SQUASH_REPO_URL || git('config --get remote.origin.url', ''),

  insecure: (process.env.SQUASH_INSECURE_TLS || 'true').toLowerCase() !== 'false',
  pageSize: Number(process.env.SQUASH_PAGE_SIZE || 200),
};

export const CREATED_BY = 'Cree automatiquement depuis le depot Playwright (scripts/squash-sync-cases.mjs)';

/* -------------------------------------------------------------------------- */
/* Client REST                                                                */
/* -------------------------------------------------------------------------- */

let requestCount = 0;
let apiRoot = null; // resolu au premier appel par probeApiRoot()

export const currentApiRoot = () => apiRoot || CFG.url.replace(/\/$/, '');

export const hasCredentials = () => Boolean(CFG.token || CFG.password);

export const authScheme = () => (CFG.token ? 'Bearer' : 'Basic');

function authHeader() {
  if (CFG.token) return 'Bearer ' + CFG.token;
  if (CFG.password) {
    return 'Basic ' + Buffer.from(`${CFG.user}:${CFG.password}`, 'utf8').toString('base64');
  }
  throw new Error(
    "Aucun identifiant : renseigne SQUASH_TOKEN (recommande) ou SQUASH_PASSWORD dans .env"
  );
}

/**
 * Appel REST. `target` est soit un chemin relatif a CFG.url ("/projects"),
 * soit une URL absolue (les liens _links renvoyes par Squash).
 */
export function api(method, target, body = null) {
  const url = new URL(target.startsWith('http') ? target : currentApiRoot() + target);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;
  const payload = body === null ? null : JSON.stringify(body);

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method,
    headers: {
      Accept: 'application/json',
      Authorization: authHeader(),
      ...(payload
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        : {}),
    },
    ...(isHttps && CFG.insecure ? { rejectUnauthorized: false } : {}),
  };

  requestCount++;

  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        const status = res.statusCode;
        let parsed = null;
        if (raw) {
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = null;
          }
        }
        if (status >= 200 && status < 300) return resolve(parsed);

        const detail =
          (parsed && (parsed.message || parsed.error || JSON.stringify(parsed).slice(0, 400))) ||
          raw.slice(0, 400) ||
          '(corps vide)';
        let aide = '';
        if (status === 401 && /basic authentication is not allowed/i.test(detail)) {
          aide =
            "\n\n  Cette instance refuse l'authentification par mot de passe sur l'API" +
            "\n  (propriete squash.rest-api.disallow-basic-authentication)." +
            '\n  Il faut un jeton personnel :' +
            "\n    1. dans Squash, menu du compte en haut a droite > ton compte >" +
            "\n       rubrique des jetons d'API > en generer un ;" +
            '\n    2. copier le jeton (il ne sera plus affiche ensuite) ;' +
            '\n    3. le mettre dans .env :  SQUASH_TOKEN=<le jeton>' +
            '\n  Le script enverra alors un en-tete Bearer au lieu de Basic.';
        } else if (status === 401) {
          aide = `\n\n  Schema utilise : ${CFG.token ? 'Bearer (jeton)' : 'Basic (mot de passe)'}.`;
        }
        const err = new Error(`HTTP ${status} sur ${method} ${url.pathname} : ${detail}${aide}`);
        err.status = status;
        err.body = parsed;
        reject(err);
      });
    });
    req.on('error', (e) =>
      reject(
        new Error(
          `Connexion impossible a ${url.origin} : ${e.message}\n` +
            `Verifie que Squash TM tourne et que SQUASH_URL est correct (actuel : ${CFG.url}).`
        )
      )
    );
    if (payload) req.write(payload);
    req.end();
  });
}

export const apiRequestCount = () => requestCount;

const embeddedKeyWarned = new Set();

/** Parcourt toutes les pages d'une collection HAL et renvoie les elements. */
export async function apiAll(target, embeddedKey) {
  const items = [];
  let page = 0;
  for (;;) {
    const sep = target.includes('?') ? '&' : '?';
    const res = await api('GET', `${target}${sep}page=${page}&size=${CFG.pageSize}`);
    const embedded = res?._embedded || {};
    let key = embeddedKey;
    if (key && !(key in embedded)) {
      // La cle HAL attendue n'existe pas dans la reponse (nom different selon
      // la version de Squash TM) : si une seule collection est presente, on
      // la prend quand meme plutot que de renvoyer une liste vide a tort
      // (ce qui ferait recreer des elements existants en aval).
      const keys = Object.keys(embedded);
      if (keys.length === 1) {
        key = keys[0];
        const warnKey = `${target.split('?')[0]}:${embeddedKey}`;
        if (!embeddedKeyWarned.has(warnKey)) {
          embeddedKeyWarned.add(warnKey);
          console.log(
            `      (i) cle HAL "${embeddedKey}" absente, utilisation de "${key}" a la place`
          );
        }
      }
    }
    key = key || Object.keys(embedded)[0];
    const chunk = key ? embedded[key] || [] : [];
    items.push(...chunk);
    const info = res?.page;
    if (!info || info.number >= info.totalPages - 1 || chunk.length === 0) break;
    page++;
  }
  return items;
}

/* -------------------------------------------------------------------------- */
/* Helpers Squash                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Squash TM tourne sous un contexte servlet (`/squash` par defaut) : l'API est
 * donc a `<host>/squash/api/rest/latest` et non `<host>/api/rest/latest`.
 * On teste la racine configuree puis la variante, pour ne pas laisser
 * l'utilisateur devant un 404 de Tomcat sans explication.
 */
export async function probeApiRoot() {
  const base = CFG.url.replace(/\/$/, '');
  const candidats = [base];

  const m = base.match(/^(https?:\/\/[^/]+)(\/.*)$/);
  if (m) {
    const [, origine, chemin] = m;
    const avec = origine + '/squash' + chemin;
    const sans = origine + chemin.replace(/^\/squash/, '');
    if (!chemin.startsWith('/squash') && !candidats.includes(avec)) candidats.push(avec);
    if (chemin.startsWith('/squash') && !candidats.includes(sans)) candidats.push(sans);
  }

  let derniere = null;
  for (const c of candidats) {
    apiRoot = c;
    try {
      await api('GET', '/projects?page=0&size=1');
      if (c !== base) {
        console.log(
          `\n  Racine d'API corrigee : ${c}\n` +
            `  (${base} renvoie 404 — Squash sert son API sous son contexte servlet)\n` +
            `  Pense a mettre SQUASH_URL=${c} dans .env.`
        );
      }
      return c;
    } catch (e) {
      derniere = e;
      if (e.status !== 404) throw e; // 401/403 : inutile d'essayer l'autre racine
    }
  }
  apiRoot = base;
  throw new Error(
    `Aucune racine d'API ne repond parmi :\n` +
      candidats.map((c) => `   - ${c}`).join('\n') +
      `\nDerniere erreur : ${derniere ? derniere.message.slice(0, 200) : 'inconnue'}\n` +
      `Verifie que les plugins API REST sont charges (jars dans squash-tm/plugins/ + service redemarre).`
  );
}

export async function findProject(name) {
  const projects = await apiAll('/projects', 'projects');
  const wanted = name.trim().toLowerCase();
  const found = projects.find((p) => String(p.name).trim().toLowerCase() === wanted);
  if (!found) {
    const dispo = projects.map((p) => `"${p.name}"`).join(', ') || '(aucun)';
    throw new Error(
      `Projet Squash "${name}" introuvable.\nProjets visibles par ${CFG.user} : ${dispo}\n` +
        `Corrige SQUASH_PROJECT dans .env.`
    );
  }
  return found;
}

/** Contenu d'un conteneur : racine du projet (projet) ou dossier. */
export async function containerContent(parent) {
  const target =
    parent._type === 'project'
      ? `/projects/${parent.id}/test-cases-library/content`
      : `/test-case-folders/${parent.id}/content`;
  return apiAll(target, 'content');
}

/**
 * Renvoie le dossier `name` sous `parent`, en le creant s'il n'existe pas.
 * Le contenu du parent est mis en cache pour eviter de le relire a chaque appel.
 */
export async function ensureFolder(name, parent, cache, { dryRun = false } = {}) {
  const cacheKey = `${parent._type}:${parent.id}`;
  if (!cache.has(cacheKey)) {
    // En simulation sans identifiants, on ne lit rien : tout est considere
    // comme a creer. Avec identifiants, la simulation reste fidele au reel.
    const lisible = !dryRun || hasCredentials();
    cache.set(cacheKey, lisible ? await containerContent(parent) : []);
  }
  const content = cache.get(cacheKey);

  const existing = content.find(
    (e) => e._type === 'test-case-folder' && String(e.name).trim() === name.trim()
  );
  if (existing) return { folder: { _type: 'test-case-folder', id: existing.id, name }, created: false };

  if (dryRun) {
    const fake = { _type: 'test-case-folder', id: `dry-${name}`, name };
    content.push({ _type: 'test-case-folder', id: fake.id, name });
    return { folder: fake, created: true };
  }

  const created = await api('POST', '/test-case-folders', {
    _type: 'test-case-folder',
    name,
    description: CREATED_BY,
    parent: { _type: parent._type, id: parent.id },
  });
  content.push({ _type: 'test-case-folder', id: created.id, name });
  return { folder: { _type: 'test-case-folder', id: created.id, name }, created: true };
}

/* -------------------------------------------------------------------------- */
/* Lecture du JSON Playwright                                                 */
/* -------------------------------------------------------------------------- */

export function flattenSuites(suites, acc = [], titles = []) {
  for (const suite of suites || []) {
    const trail = suite.title ? [...titles, suite.title] : titles;
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        acc.push({
          // `trail` commence par le chemin du fichier, puis les test.describe
          describes: trail.filter((x) => !/\.spec\.(ts|js|mjs)$/i.test(x)),
          title: spec.title,
          file: (suite.file || spec.file || '').replace(/\\/g, '/'),
          line: spec.line || 0,
          project: t.projectName || '',
          // Issue de l'execution : vide quand le JSON vient de `--list`.
          // expected | unexpected | flaky | skipped
          outcome: t.status || '',
          attempts: (t.results || []).map((r) => ({
            status: r.status || '',
            duration: r.duration || 0,
            error: (r.error && r.error.message) || '',
          })),
        });
      }
    }
    if (suite.suites?.length) flattenSuites(suite.suites, acc, trail);
  }
  return acc;
}

export function readPlaywrightJson(file) {
  if (!fs.existsSync(file)) throw new Error(`Fichier JSON Playwright introuvable : ${file}`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return flattenSuites(data.suites);
}

/** api/comptabilite_generale/tests/ecriture.spec.ts -> comptabilite_generale */
export function moduleOf(file) {
  const parts = file.split('/');
  return parts.length > 1 ? parts[1] : 'divers';
}

/** api/comptabilite_generale/tests/ecriture.spec.ts -> ecriture */
export function specNameOf(file) {
  return path.basename(file).replace(/\.spec\.(ts|js|mjs)$/i, '');
}

/** Nom du cas : chaine des describe + titre, tronque a 255 caracteres. */
export function caseName(t) {
  const full = [...t.describes, t.title].filter(Boolean).join(' > ').replace(/\s+/g, ' ').trim();
  return full.length <= 255 ? full : full.slice(0, 252) + '...';
}

/** Reference stable, insensible au renommage du titre affiche. */
export function caseReference(t) {
  const seed = `${t.project}|${t.file}|${[...t.describes, t.title].join(' > ')}`;
  return 'PW-' + crypto.createHash('sha1').update(seed).digest('hex').slice(0, 10).toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Extraction des etapes depuis le code source                                */
/* -------------------------------------------------------------------------- */

const sourceCache = new Map();

function sourceLines(file) {
  const abs = path.join(ROOT, file);
  if (!sourceCache.has(abs)) {
    sourceCache.set(abs, fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').split(/\r?\n/) : null);
  }
  return sourceCache.get(abs);
}

/**
 * Position de l'accolade ouvrante du corps de la fonction de rappel passee a
 * test(...). On saute chaines, gabarits et commentaires pour ne pas se faire
 * piéger par une fleche ou une accolade dans le titre du test.
 */
function callbackBodyStart(text) {
  let inS = null, esc = false, comment = null;
  let arrow = -1;

  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];

    if (comment === '//') { if (c === '\n') comment = null; continue; }
    if (comment === '/*') { if (c === '*' && next === '/') { comment = null; i++; } continue; }
    if (inS) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === inS) inS = null;
      continue;
    }
    if (c === '/' && next === '/') { comment = '//'; i++; continue; }
    if (c === '/' && next === '*') { comment = '/*'; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { inS = c; continue; }

    if (c === '=' && next === '>') { arrow = i + 2; break; }
    // forme `async function () {` : on s'arrete au mot-cle
    if (text.startsWith('function', i)) { arrow = i + 8; break; }
  }
  if (arrow === -1) return -1;
  const brace = text.indexOf('{', arrow);
  return brace === -1 ? -1 : brace;
}

/**
 * Extrait le corps du test situe a `line` (1-based) : on part de la ligne,
 * on cherche la premiere accolade ouvrante puis on compte les accolades en
 * ignorant chaines, gabarits, expressions regulieres et commentaires.
 */
export function extractTestBody(file, line) {
  const lines = sourceLines(file);
  if (!lines || line < 1 || line > lines.length) return '';
  const text = lines.slice(line - 1).join('\n');

  // Le corps est celui de la fonction de rappel : il faut donc partir de la
  // fleche `=>` (ou du mot-cle `function`), sinon la premiere accolade
  // rencontree est celle du destructurant des fixtures — test('x', async ({ client }) => {...})
  let i = callbackBodyStart(text);
  if (i === -1) return '';

  let depth = 0;
  let inS = null; // ' " ` /
  let esc = false;
  let comment = null; // // ou /*
  let start = -1;

  for (; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (comment === '//') {
      if (c === '\n') comment = null;
      continue;
    }
    if (comment === '/*') {
      if (c === '*' && next === '/') { comment = null; i++; }
      continue;
    }
    if (inS) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === inS) inS = null;
      continue;
    }
    if (c === '/' && next === '/') { comment = '//'; i++; continue; }
    if (c === '/' && next === '*') { comment = '/*'; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { inS = c; continue; }

    if (c === '{') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i).replace(/^\n+|\s+$/g, '');
    }
  }
  return '';
}

/** Decoupe un corps de test en instructions de premier niveau. */
function topLevelStatements(body) {
  const out = [];
  let depth = 0, inS = null, esc = false, comment = null, buf = '';

  for (let i = 0; i < body.length; i++) {
    const c = body[i], next = body[i + 1];

    if (comment === '//') { if (c === '\n') comment = null; continue; }
    if (comment === '/*') { if (c === '*' && next === '/') { comment = null; i++; } continue; }
    if (!inS) {
      if (c === '/' && next === '/') { comment = '//'; i++; continue; }
      if (c === '/' && next === '*') { comment = '/*'; i++; continue; }
    }

    buf += c;

    if (inS) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === inS) inS = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { inS = c; continue; }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if (c === ';' && depth === 0) {
      const s = buf.slice(0, -1).trim();
      if (s) out.push(s);
      buf = '';
    }
  }
  const rest = buf.trim();
  if (rest) out.push(rest);
  return out;
}

const ASSERTION = /\b(expect|expectStatusIn|expectJsonArray|expectValidPage|assert)\w*\s*\(/;
const SKIP = /\btest\.(skip|fixme|slow)\s*\(/;

/** Recupere les libelles des test.step('...') presents dans le corps. */
function explicitSteps(body) {
  const steps = [];
  const re = /test\.step\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let m;
  while ((m = re.exec(body))) steps.push(m[2].replace(/\\(['"`])/g, '$1'));
  return steps;
}

export function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Le code source Playwright contient souvent des template literals
    // (`${ANALYTIQUE_PATHS.budgetsBase}` etc.). Squash TM interprete tout
    // "${...}" dans le contenu d'une etape/description comme une reference
    // de parametre de jeu de donnees et rejette (HTTP 412) les noms qui ne
    // sont pas des identifiants valides (points, etc.). On neutralise donc
    // le '$' pour que la sequence litterale "${" n'apparaisse jamais dans
    // le contenu envoye a l'API, tout en gardant un rendu visuel identique.
    .replace(/\$/g, '&#36;');
}

const codeBlock = (s) => `<pre>${htmlEscape(s)}</pre>`;
const para = (s) => `<p>${htmlEscape(s)}</p>`;

/**
 * Construit les etapes Squash a partir du corps du test.
 *  - si le test utilise test.step(), ces libelles font foi ;
 *  - sinon on regroupe les instructions : les appels forment l'action,
 *    la premiere assertion qui suit forme le resultat attendu.
 */
export function deriveSteps(body, { mode = 'derived' } = {}) {
  if (!body) return { steps: [], skips: [], source: 'vide' };

  const statements = topLevelStatements(body);
  const skips = statements.filter((s) => SKIP.test(s));

  if (mode === 'raw') {
    return {
      steps: [{ action: codeBlock(body), expected_result: para('Le test Playwright passe.') }],
      skips,
      source: 'code brut',
    };
  }

  const labels = explicitSteps(body);
  if (labels.length) {
    return {
      steps: labels.map((l) => ({ action: para(l), expected_result: '' })),
      skips,
      source: 'test.step()',
    };
  }

  const steps = [];
  let actions = [];

  for (const st of statements) {
    if (SKIP.test(st)) continue;
    if (ASSERTION.test(st)) {
      steps.push({
        action: actions.length ? codeBlock(actions.join('\n')) : para('Poursuivre le scenario'),
        expected_result: codeBlock(st),
      });
      actions = [];
    } else {
      actions.push(st.endsWith(';') ? st : st + ';');
    }
  }
  if (actions.length) {
    steps.push({ action: codeBlock(actions.join('\n')), expected_result: '' });
  }

  if (!steps.length) {
    steps.push({ action: codeBlock(body), expected_result: para('Le test Playwright passe.') });
    return { steps, skips, source: 'code brut (repli)' };
  }
  return { steps, skips, source: 'deduit du code' };
}

/** Prerequis : conditions de skip + commande pour rejouer le test seul. */
export function buildPrerequisite(t, skips) {
  const parts = [];
  if (skips.length) {
    parts.push('<p><strong>Conditions d’exclusion declarees dans le test :</strong></p>');
    parts.push(codeBlock(skips.join('\n')));
  }
  parts.push('<p><strong>Rejouer ce test seul :</strong></p>');
  parts.push(codeBlock(`npx playwright test --project=${t.project} ${t.file}:${t.line}`));
  return parts.join('\n');
}

export function buildDescription(t, stepSource) {
  const rows = [
    ['Module', moduleOf(t.file)],
    ['Fichier', `${t.file}:${t.line}`],
    ['Suite', t.describes.join(' > ') || '(racine)'],
    ['Projet Playwright', t.project],
    ['Branche', CFG.branch + (CFG.commit ? ` (${CFG.commit})` : '')],
    ['Etapes', stepSource],
  ];
  if (CFG.repoUrl) rows.push(['Depot', CFG.repoUrl]);

  const body = rows
    .map(([k, v]) => `<tr><td><strong>${htmlEscape(k)}</strong></td><td>${htmlEscape(v)}</td></tr>`)
    .join('');
  return `<p>${htmlEscape(CREATED_BY)}</p><table>${body}</table>`;
}

/** Reference technique du script automatise, au format fichier#test. */
export function automatedReference(t) {
  return `${t.file}#${[...t.describes, t.title].join(' > ')}`.slice(0, 255);
}

/* -------------------------------------------------------------------------- */
/* Campagnes, iterations et executions                                        */
/* -------------------------------------------------------------------------- */

/** Origine des objets crees par la publication des resultats. */
export const PUSHED_BY =
  'Cree automatiquement depuis le depot Playwright (scripts/squash-push-results.mjs)';

/**
 * Issue Playwright -> statut d'execution Squash.
 *
 * Les statuts acceptes par l'API sont SUCCESS, FAILURE, BLOCKED, UNTESTABLE,
 * SETTLED, READY et RUNNING ; toute autre valeur provoque un HTTP 500.
 * Un test « flaky » a fini par passer : il compte comme un succes, et le
 * commentaire de l'execution signale les tentatives.
 */
export const STATUT_SQUASH = {
  expected: 'SUCCESS',
  unexpected: 'FAILURE',
  flaky: 'SUCCESS',
  skipped: 'UNTESTABLE',
};

/** Renvoie la campagne `name` du projet, en la creant si besoin. */
export async function ensureCampaign(name, projet, { dryRun = false } = {}) {
  // La cle HAL de cette collection est `campaign-library-content` ; `apiAll`
  // sait se rabattre si une version de Squash la nomme autrement.
  const contenu = await apiAll(
    `/projects/${projet.id}/campaigns-library/content`,
    'campaign-library-content'
  );
  const existante = contenu.find(
    (e) => e._type === 'campaign' && String(e.name).trim() === name.trim()
  );
  if (existante) return { campagne: { id: existante.id, name }, created: false };
  if (dryRun) return { campagne: { id: `dry-${name}`, name }, created: true };

  const creee = await api('POST', '/campaigns', {
    _type: 'campaign',
    name,
    description: PUSHED_BY,
    // Seuls `project` et `campaign-folder` sont acceptes comme parent.
    parent: { _type: 'project', id: projet.id },
  });
  return { campagne: { id: creee.id, name }, created: true };
}

/** Cree une iteration sous la campagne. Une execution = une iteration. */
export async function createIteration(campagneId, name, { dryRun = false } = {}) {
  if (dryRun) return { id: `dry-${name}`, name };
  const it = await api('POST', `/campaigns/${campagneId}/iterations`, {
    _type: 'iteration',
    name,
    description: PUSHED_BY,
  });
  return { id: it.id, name };
}

/** Ajoute un cas au plan d'execution de l'iteration et renvoie l'item cree. */
export async function addTestPlanItem(iterationId, testCaseId) {
  const item = await api('POST', `/iterations/${iterationId}/test-plan`, {
    _type: 'test-plan-item',
    test_case: { _type: 'test-case', id: testCaseId },
  });
  return item.id;
}

/** Ouvre une execution sur un item du plan. Elle demarre au statut READY. */
export async function createExecution(itemId) {
  const ex = await api('POST', `/test-plan-items/${itemId}/executions`, {});
  return ex.id;
}

/** Positionne le statut et le commentaire d'une execution. */
export async function setExecutionResult(executionId, statut, commentaire) {
  return api('PATCH', `/executions/${executionId}`, {
    _type: 'execution',
    execution_status: statut,
    comment: commentaire,
  });
}

/**
 * Indexe les cas de test du projet par nom.
 *
 * Le nom est le seul lien fiable avec le depot : la reference est renumerotee
 * par `squash-renumber-ids.mjs` et `automated_test_reference` reste vide quand
 * l'instance refuse les champs d'automatisation.
 */
export async function indexTestCasesByName(projetId) {
  const tous = await apiAll('/test-cases', 'test-cases');
  const index = new Map();
  for (const c of tous) {
    if (projetId && c.project && c.project.id && c.project.id !== projetId) continue;
    const cle = String(c.name).trim();
    if (!index.has(cle)) index.set(cle, { id: c.id, reference: c.reference || '' });
  }
  return index;
}
