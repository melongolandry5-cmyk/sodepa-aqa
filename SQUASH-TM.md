# Squash TM — synchronisation du catalogue Playwright

Ce document décrit `scripts/squash-sync-cases.mjs`, qui pousse le **catalogue**
des tests Playwright vers Squash TM. Il n'exécute aucun test et ne crée aucune
campagne : il crée l'arborescence de cas de test.

```
Squash TM ── Cas de test / Campagnes / Exigences
     ▲
     │  catalogue (scripts/squash-sync-cases.mjs, API REST)
     │
Playwright ── projet « api » : 9 modules, 15 fichiers, 475 tests
```

La source du catalogue est `playwright test --list` : les cas de test ne sont
jamais saisis à la main, ils sont déduits du dépôt.

---

## 1. Ce que le script crée

```
erp sodepa
└─ Playwright API                    ← SQUASH_ROOT_FOLDER
   ├─ audit
   │  └─ audit                       ← un dossier par fichier .spec.ts
   │     ├─ API — Audit (/api/auth/audit) > les activités du porteur…
   │     └─ …
   ├─ comptabilite_generale
   │  ├─ ecriture        (19 cas)
   │  ├─ immobilisation  (25 cas)
   │  ├─ rapprochement   (22 cas)
   │  ├─ referentiel     (44 cas)
   │  └─ reporting       (18 cas)
   └─ …
```

Chaque cas de test porte :

| Champ Squash | Contenu |
|---|---|
| Nom | chaîne des `test.describe()` + titre du test |
| Référence | `PW-XXXXXXXXXX`, empreinte de `fichier + suite + titre` |
| Description | module, `fichier:ligne`, suite, projet Playwright, branche et commit |
| Prérequis | conditions de `test.skip()` + commande pour rejouer le test seul |
| Étapes | action = les appels, résultat attendu = l'assertion qui suit |
| Réf. technique | `api/<module>/tests/<fichier>.spec.ts#<suite> > <titre>` |

La **référence** est la clé d'idempotence : elle ne dépend pas du libellé
affiché, donc renommer un cas dans Squash ne provoque pas de doublon à la
synchronisation suivante.

---

## 2. Configuration

Dans `.env` à la racine (déjà pré-rempli, il manque le secret) :

```dotenv
SQUASH_URL=http://localhost:8090/squash/api/rest/latest
SQUASH_USER=admin
SQUASH_TOKEN=                 # jeton d'API — recommandé
SQUASH_PASSWORD=              # à défaut, le mot de passe du compte
SQUASH_PROJECT=erp sodepa
SQUASH_ROOT_FOLDER=Playwright API
```

### Le jeton n'est pas optionnel

Squash TM 15 refuse par défaut l'authentification par mot de passe sur l'API :

```
HTTP 401 : Basic authentication is not allowed for REST API.
```

C'est le comportement de la propriété `squash.rest-api.disallow-basic-authentication`,
passée à `true` par défaut ; l'éditeur annonce l'abandon complet du Basic pour l'API.
Il faut donc un **jeton personnel**, envoyé en en-tête `Bearer` :

1. dans Squash, menu du compte en haut à droite > ton compte ;
2. rubrique des jetons d'API > en générer un ;
3. copier le jeton — il n'est affiché qu'une fois ;
4. le coller dans `.env` : `SQUASH_TOKEN=<le jeton>`.

Le script choisit seul le schéma : `Bearer` si `SQUASH_TOKEN` est renseigné,
`Basic` sinon. Laisse `SQUASH_PASSWORD` vide une fois le jeton en place.

Un jeton se révoque sans toucher au compte et porte une date d'expiration —
c'est ce qu'il faut pour un script qui vit dans un dépôt.

> Il existe une porte de sortie : remettre `squash.rest-api.disallow-basic-authentication=false`
> dans `conf/squash.tm.cfg.properties` puis redémarrer le service. À éviter :
> cela réactive un mécanisme que l'éditeur retire, et fait transiter le mot de
> passe du compte à chaque appel.

Le compte utilisé doit avoir le droit de créer des cas de test sur le projet
(profil *Testeur avancé* ou *Chef de projet*).

---

## 3. Utilisation

```powershell
npm run squash:dry      # simulation : affiche ce qui serait créé, n'écrit rien
npm run squash:plan     # exporte squash-plan.json : les payloads exacts, pour relecture
npm run squash:sync     # création réelle dans Squash
```

Options :

```powershell
node scripts/squash-sync-cases.mjs --module audit      # un seul module
node scripts/squash-sync-cases.mjs --grep @smoke       # filtre Playwright
node scripts/squash-sync-cases.mjs --limit 5           # les 5 premiers cas
node scripts/squash-sync-cases.mjs --raw-steps         # une étape = le code brut
node scripts/squash-sync-cases.mjs --from liste.json   # repart d'un JSON déjà produit
```

**Ordre conseillé la première fois :**

1. `npm run squash:dry` — vérifie l'arborescence et le nombre de cas ;
2. `node scripts/squash-sync-cases.mjs --module audit` — 11 cas réels, à relire dans l'interface ;
3. `npm run squash:sync` — les 475.

Le script est **idempotent** : relancé, il ignore les cas déjà présents et ne
crée que les nouveaux. C'est le mode d'emploi normal après l'ajout de tests.

---

## 4. Étapes des cas de test

Les specs n'utilisent pas `test.step()`. Le script déduit donc les étapes du
code : il découpe le corps du test en instructions, regroupe les appels en
**action** et prend l'assertion qui suit comme **résultat attendu**.

```ts
const response = await auditClient.transactionsClickHouse(5, [200, ...CLICKHOUSE_INDISPONIBLE]);

if (response.status() === 200) {
  const lignes = await expectJsonArray(response);
  expect(lignes.length).toBeLessThanOrEqual(5);
}
```

donne une étape dont l'action est le premier bloc et le résultat attendu le
second.

Dès qu'un test contient de vrais `test.step('…')`, **ceux-ci font foi** et
remplacent l'heuristique, sans changement de configuration. C'est la trajectoire
visée : instrumenter progressivement les specs améliore à la fois Squash et le
rapport Allure.

---

## 5. Champs d'automatisation

`automatable`, `automated_test_technology` et `automated_test_reference` ne sont
acceptés par Squash que si la fonctionnalité **Serveurs d'exécution automatisée**
est activée et que le projet a un workflow d'automatisation. Sinon Squash les
ignore ou renvoie un HTTP 400.

Le script gère les deux cas : il tente avec ces champs, et au premier refus il
bascule en mode dégradé pour tout le reste de l'exécution, en le signalant. La
référence technique du script reste dans la description du cas, donc rien n'est
perdu.

Pour les activer : Administration > Système, puis le workflow d'automatisation
au niveau du projet. Relancer ensuite la synchronisation.

---

## 6. Dépannage

| Symptôme | Cause probable |
|---|---|
| `Connexion impossible` | Squash arrêté, ou mauvais port |
| `HTTP 404` sur `/projects` | il manque le contexte `/squash` dans `SQUASH_URL` — le script le détecte et le corrige seul, mais corrige aussi `.env` |
| `HTTP 401` `Basic authentication is not allowed` | il faut un jeton dans `SQUASH_TOKEN`, le mot de passe ne suffit pas |
| `HTTP 401` autre | jeton faux, expiré ou révoqué |
| `HTTP 403` | le compte n'a pas le droit de créer des cas sur le projet |
| `Projet "…" introuvable` | `SQUASH_PROJECT` ne correspond pas au nom exact, ou le compte ne voit pas le projet |
| `HTTP 400` sur `nature`/`type` | code absent de la liste personnalisée du projet — laisser `SQUASH_NATURE` et `SQUASH_TYPE` vides |
| Playwright ne produit pas de liste | lancer d'abord `npx playwright test --list --project=api` pour voir l'erreur de compilation |

Le script s'arrête au bout de 5 échecs consécutifs pour éviter de remplir Squash
d'à-peu-près. Comme il est idempotent, on corrige puis on relance.

---

## 7. Reprise après coup

Pour repartir de zéro sur un module : supprimer son dossier dans Squash
(clic droit > Supprimer), puis relancer `--module <nom>`.

Pour tout reprendre : supprimer le dossier `Playwright API` et relancer
`npm run squash:sync`.

---

## 8. Publication des résultats d'exécution

`squash:sync` pousse le **catalogue** des cas. `squash:push` pousse ce qu'une
campagne a **donné**, refermant la chaîne :

```
npx playwright test ──> allure-report/index.html ──> Squash TM
     (résultats)          (rapport partageable)      (exécutions)
```

En une commande : `.\scripts\run-qa.ps1 -Project api`

### Ce que le script crée

```
Projet « erp sodepa »
└── Campagne « Playwright API »          <- SQUASH_CAMPAIGN, créée une fois
    └── Itération « main a1b2c3d - ... » <- une par exécution
        └── 14 items de plan
            └── 1 exécution chacun, avec statut et commentaire
```

Le commentaire porte le module, le fichier et la ligne, le projet Playwright,
la durée, le nombre de tentatives, le commit, l'erreur en cas d'échec, et le
lien vers le rapport Allure si `SQUASH_ALLURE_URL` est renseigné.

### Correspondance des statuts

| Playwright   | Squash       |
| ------------ | ------------ |
| `expected`   | `SUCCESS`    |
| `unexpected` | `FAILURE`    |
| `flaky`      | `SUCCESS`    |
| `skipped`    | `UNTESTABLE` |

Un test instable compte comme un succès : il a fini par passer. Le commentaire
signale les tentatives, pour que l'instabilité reste visible.

### Rapprochement avec les cas

Le lien entre un résultat et un cas Squash se fait **par le nom du cas**. Ni la
référence (renumérotée par `squash:renumber`) ni `automated_test_reference`
(vide quand l'instance refuse les champs d'automatisation) ne sont fiables.

Un test sans cas correspondant est signalé comme orphelin et ignoré : lancer
`npm run squash:sync` d'abord.

### Commandes

```powershell
npm run squash:push:check   # vérifie la connexion et le rapprochement
npm run squash:push:dry     # affiche ce qui serait publié, sans rien écrire
npm run squash:push         # publie
```

La source est `test-results/results.json`, produit par le reporter `json`. Un
fichier issu d'un `playwright test --list` ne contient aucune issue : le script
le détecte et refuse de publier plutôt que de remonter des résultats vides.
