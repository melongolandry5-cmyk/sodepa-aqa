# Sodepa AQA — Playwright (API + UI)

Dépôt d'automatisation des tests de l'ERP Sodepa. Autonome : il ne dépend
d'aucun chemin du dépôt backend, la seule référence à celui-ci vit dans le
`.env` (`API_BASE_URL`, `UI_BASE_URL`, `BACKEND_SOURCE_PATH`).

**Couverture : 142 routes REST, 475 tests API + 4 tests UI.**

## Architecture

Un dossier par module fonctionnel. Chaque module est autonome : ses chemins,
ses clients, ses fixtures et ses tests vivent ensemble.

```
sodepa-aqa/
├── api/
│   ├── authentication/
│   │   ├── client/                          # un client par contrôleur REST
│   │   ├── tests/                           # les .spec.ts du module
│   │   ├── authentication-api-paths.ts      # chemins + routes déclarées
│   │   └── authentication-fixtures.ts       # injection des clients du module
│   ├── audit/
│   ├── budget/
│   ├── comptabilite_analytique/
│   ├── comptabilite_generale/
│   │   ├── client/
│   │   ├── helpers/                         # helpers propres au module
│   │   ├── tests/
│   │   ├── comptabilite-generale-api-paths.ts
│   │   └── comptabilite-generale-fixtures.ts
│   ├── financement/
│   ├── system_core/                         # tests transverses (sécurité, surface)
│   ├── tresorerie/
│   ├── types/                               # types partagés (PageRecord, EndpointDescriptor…)
│   └── user_management/
├── helpers/                                 # fonctions communes à tous les modules
│   ├── assertions.ts                        # expectValidPage, expectStatusIn…
│   ├── base-api-client.ts                   # socle des clients REST
│   ├── base-fixtures.ts                     # session, apiContext, anonContext
│   ├── env.ts                               # lecture typée du .env
│   ├── http.ts                              # appels bruts + familles de statuts
│   └── logger.ts
├── test-data/                               # données de test, tous modules
│   ├── builders.ts                          # corps valides, UUID, dates
│   └── users.ts                             # comptes de test
├── ui/
│   ├── pages/                               # Page Objects
│   ├── setup/auth.setup.ts                  # session UI sérialisée
│   ├── tests/
│   └── ui-fixtures.ts
├── playwright.config.ts
└── .env / .env.example
```

### Les quatre fichiers d'un module

| Fichier | Rôle |
| --- | --- |
| `<module>-api-paths.ts` | tous les chemins du module, en constantes et en fonctions (`plan(id)`), plus le tableau `*_ENDPOINTS` décrivant chaque route. Aucun autre fichier ne construit d'URL. |
| `client/*.ts` | un client par contrôleur : méthodes typées pour le chemin nominal, variantes `*Raw` pour examiner une réponse en erreur. |
| `<module>-fixtures.ts` | dérive `helpers/base-fixtures.ts` et injecte les clients du module. Un module peut importer le client d'un autre quand un test a besoin de ses données (un plan budgétaire suppose un utilisateur). |
| `tests/*.spec.ts` | les cas de test, qui n'importent que les fixtures de leur module, `helpers/` et `test-data/`. |

`api/system_core/system-core-api-paths.ts` agrège les `*_ENDPOINTS` de tous les
modules : c'est la source des tests transverses.

## Prérequis

- Node.js 18+ (testé avec Node 26)
- Le backend démarré (`mvnw spring-boot:run` dans le dépôt `sodepa_backend`)
- Ses dépendances actives : PostgreSQL (5433), Redis, Keycloak (8070, realm `sodepa`)

## Installation

```bash
npm install
npm run install:browsers   # télécharge Chromium
cp .env.example .env       # puis renseigner les comptes et les URLs
```

## Lancer les tests

| Commande | Effet |
| --- | --- |
| `npm test` | tous les projets |
| `npm run test:api` | tests REST uniquement (aucun navigateur) |
| `npm run test:ui` | tests d'interface (dépend du projet `ui-setup`) |
| `npm run test:headed` | tests UI avec navigateur visible |
| `npm run test:debug` | inspecteur Playwright |
| `npm run report` | ouvre le rapport HTML |
| `npm run typecheck` | vérification TypeScript sans exécution |

Cibler un module, un fichier ou un titre :

```bash
npx playwright test api/financement
npx playwright test api/comptabilite_generale/tests/ecriture.spec.ts
npx playwright test -g "pagination"
```

## Couverture par module

| Module | Tests | Contrôleurs backend couverts |
| --- | --- | --- |
| `system_core` | 146 | tous (sécurité transverse + garde-fou de surface) |
| `comptabilite_generale` | 128 | banque, compte, tiers, journal, écriture, immobilisation, clôture, rapprochement, reporting |
| `budget` | 56 | plans, engagements, collaboratif, workflow |
| `tresorerie` | 35 | trésorerie, change, arbitrage, pilotage |
| `financement` | 34 | financements, simulation, hors-bilan, KPI |
| `comptabilite_analytique` | 30 | axes, sections, ventilations, budgets, clés, reporting |
| `user_management` | 21 | utilisateurs et permissions |
| `authentication` | 14 | login, refresh, logout, sessions |
| `audit` | 11 | audit ClickHouse et piste d'audit métier |

Types de cas couverts pour chaque endpoint : chemin nominal, pagination et tri,
filtres, validation de chaque champ contraint (`@NotBlank`, `@NotNull`,
`@Positive`, `@Email`, énumérations), ressource inexistante, identifiant
malformé, paramètre obligatoire absent, et refus d'accès sans jeton.

## Comment ça s'authentifie

`POST /api/auth/login` est public (cf. `SecurityConfig.PUBLIC_ENDPOINTS`) et
renvoie la réponse Keycloak (`access_token`, `refresh_token`, …). La fixture
`session` de `helpers/base-fixtures.ts` l'appelle **une fois par worker** ;
`apiContext` en dérive un `APIRequestContext` portant l'en-tête
`Authorization: Bearer …`. La fixture `anonContext` reste sans jeton pour
tester les refus d'accès.

## Le garde-fou de couverture

`api/system_core/tests/surface.spec.ts` lit les sources Java du backend,
extrait toutes les routes déclarées par les `@*Mapping` et vérifie dans les deux
sens qu'elles correspondent au registre agrégé. Une route ajoutée au backend
sans test fait échouer ce fichier ; une entrée du registre pointant vers une
route supprimée aussi.

Il trouve les sources via `BACKEND_SOURCE_PATH` (.env) — **la seule adhérence du
dépôt AQA au dépôt backend**. Variable vide ou chemin absent : le test se met en
skip et le reste de la suite tourne normalement. C'est le mode attendu d'une CI
qui ne clone que ce dépôt.

**Ajouter une route au backend implique :** l'ajouter au `*-api-paths.ts` de son
module, étendre le client correspondant, puis écrire ses cas dans `tests/`.

## Tests destructifs

Certains endpoints sont irréversibles ou polluants : clôture d'exercice,
réévaluation de devises, suppression de compte, bascule d'activation d'un
journal, changement de mot de passe, rapprochement automatique. Ces tests
existent mais sont en `skip` tant que `RUN_DESTRUCTIVE=true` n'est pas
positionné dans le `.env`. **À n'activer que sur un environnement jetable.**

## Conventions

- Les tests sont indépendants ; ceux qui ont besoin de données existantes se
  mettent en `skip` explicite avec un motif lisible plutôt que d'échouer.
- Aucune URL en dur hors des `*-api-paths.ts`.
- Les assertions de statut passent par `expectStatusIn`, qui remonte le corps de
  la réponse dans le message d'échec — indispensable pour distinguer un 500
  fonctionnel d'un 400 de validation.
- Les familles de statuts acceptés (`BAD_REQUEST_STATUSES`, `NOT_FOUND_STATUSES`)
  sont larges à dessein : `GestionnaireErreursApi` ne normalise pas encore tous
  les cas, et les tests documentent le comportement réel sans le figer trop tôt.
- Les assertions de pagination passent par `expectValidPage`.
- Les traces, captures et vidéos ne sont conservées qu'en cas d'échec.

## État des tests UI

Aucun front n'est encore disponible : les specs de `ui/tests/` sont écrites mais
marquées `describe.skip`, et `ui/setup/auth.setup.ts` se met en `skip` si
`UI_BASE_URL` est injoignable. Pour les activer : renseigner `UI_BASE_URL`,
retirer les `.skip`, puis aligner les locators des Page Objects sur le vrai DOM
(de préférence via des `data-testid`).
