# Sodepa AQA — Playwright (API + UI)

Dépôt d'automatisation des tests de l'ERP Sodepa. Autonome : il ne dépend
d'aucun chemin du dépôt backend, la seule référence à celui-ci vit dans le
`.env` (`API_BASE_URL`, `UI_BASE_URL`, `BACKEND_SOURCE_PATH`).

**Couverture : 142 routes REST, 475 tests API + 4 tests UI.**

## Stack technique

| Outil | Version | Rôle |
| --- | --- | --- |
| Node.js | 18+ | runtime |
| Playwright (`@playwright/test`) | ^1.49 | runner, appels REST et automatisation navigateur |
| TypeScript | ^5.7 | langage, vérifié par `npm run typecheck` |
| dotenv | ^16.4 | lecture du `.env` (via `helpers/env.ts`, jamais `process.env` en direct) |

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
│   │   ├── client/
│   │   ├── tests/
│   │   ├── budget-api-paths.ts
│   │   ├── budget-fixtures.ts
│   │   └── budget-payload-builder.ts        # corps de requête propres au module
│   ├── comptabilite_analytique/
│   ├── comptabilite_generale/
│   │   ├── client/
│   │   ├── helpers/                         # helpers + corps de requête du module
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

### Les fichiers d'un module

| Fichier | Rôle |
| --- | --- |
| `<module>-api-paths.ts` | tous les chemins du module, en constantes et en fonctions (`plan(id)`), plus le tableau `*_ENDPOINTS` décrivant chaque route. Aucun autre fichier ne construit d'URL. |
| `client/*.ts` | un client par contrôleur : méthodes typées pour le chemin nominal, variantes `*Raw` pour examiner une réponse en erreur. |
| `<module>-fixtures.ts` | dérive `helpers/base-fixtures.ts` et injecte les clients du module. Un module peut importer le client d'un autre quand un test a besoin de ses données (un plan budgétaire suppose un utilisateur). |
| `tests/*.spec.ts` | les cas de test, qui n'importent que les fixtures de leur module, `helpers/` et `test-data/`. |
| `<module>-payload-builder.ts` _(optionnel)_ | les corps de requête propres au module, quand il n'a pas déjà un `helpers/` dédié au concept. Voir [Propriété des générateurs de données](#propriété-des-générateurs-de-données). |

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

### Variables d'environnement

Toutes sont lues au même endroit, `helpers/env.ts` : aucun test ni client ne
touche `process.env` directement.

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `API_BASE_URL` | `http://localhost:8082` | backend Spring Boot (`server.port` du dépôt `sodepa_backend`) |
| `UI_BASE_URL` | `http://localhost:4200` | front de l'ERP |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / … | compte de test administrateur (realm Keycloak `sodepa`) |
| `COMPTABLE_USERNAME` / `COMPTABLE_PASSWORD` | `comptable` / … | compte de test métier |
| `HEADLESS` | `true` | `false` pour voir le navigateur |
| `API_TIMEOUT_MS` | `30000` | délai des appels REST |
| `RUN_DESTRUCTIVE` | `false` | `true` pour exécuter les tests irréversibles — environnement jetable uniquement |
| `BACKEND_SOURCE_PATH` | `../sodepa_backend/src/main/java` | sources Java du backend pour le garde-fou de couverture. Vide ou absent : le garde-fou se met en skip |
| `DEBUG_AQA` | `false` | `true` pour la journalisation verbeuse du socle (`helpers/logger.ts`) |

Une variable réellement obligatoire passe par `required()` et fait échouer le
démarrage avec un message explicite, plutôt que de laisser un test partir avec
une URL `undefined`.

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

## Qualité du code

```bash
# Vérification TypeScript sans exécution
npm run typecheck
```

`typecheck` n'est pas un doublon d'un futur linter : un linter en configuration
`recommended` ne résout pas les exports des modules et un formateur ne fait que
reformater. Ni l'un ni l'autre ne détecte un import cassé — importer un nom qui
n'est plus exporté par le module cible. Seul `tsc --noEmit` attrape cette classe
d'erreur, d'où une étape à part entière plutôt qu'une option du lint.

À faire évoluer quand l'équipe s'agrandit : ajouter ESLint
(+ `eslint-plugin-playwright`) et Prettier, puis un hook de pré-commit Husky
enchaînant `lint` (avec `--max-warnings=0`), `typecheck` et `format:check`. Deux
règles à conserver au moment de le faire : garder `typecheck` comme étape
distincte du lint pour la raison ci-dessus, et **ne pas** mettre `eslint --fix`
dans le hook — une correction automatique silencieuse au moment du commit rend
la revue de diff mensongère.

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

### Nommage des dossiers

**snake_case**, sans exception :

```
# Correct
api/comptabilite_generale/
api/comptabilite_generale/client/
api/system_core/

# Incorrect
api/comptabiliteGenerale/
api/system-core/
```

### Nommage des fichiers

**kebab-case**, conformément au standard de la documentation Playwright
(`example.spec.ts`, `todo-page.ts`) :

```
# Correct
comptabilite-generale-api-paths.ts
budget-plan-client.ts
ecriture.spec.ts
```

### Nommage des constantes

| Élément | Convention | Exemple |
| --- | --- | --- |
| Objet conteneur de chemins exporté | `UPPER_SNAKE_CASE` | `BUDGET_PATHS`, `BUDGET_ENDPOINTS` |
| Clés et descripteurs de chemin | `camelCase` | `planItems`, `plan(planId)` |
| Familles de statuts partagées | `UPPER_SNAKE_CASE` | `BAD_REQUEST_STATUSES` |

Les clés reprennent le nom de la ressource REST telle que l'expose le backend,
pour que le registre reste directement traçable jusqu'au contrôleur Java.

### Maintenance des chemins d'API

Chaque module maintient ses chemins dans son propre `*-api-paths.ts`. Deux
règles pour que ces fichiers ne deviennent pas illisibles à mesure que la
surface grandit :

- Regrouper les chemins par sous-domaine dans des constantes de base
  (`BASE_COLLABORATIF`, `BASE_WORKFLOW`) ou des objets imbriqués, plutôt qu'en
  une liste plate de cinquante entrées.
- **Aucune URL en dur** hors de ces fichiers : ni dans un client, ni dans un
  test. Un chemin qui n'existe pas dans le registre n'existe pas pour la suite,
  et le garde-fou de couverture s'appuie sur cette règle. La seule exception est
  l'URL volontairement inexistante du test « 404 et non 403 », nommée
  `ROUTE_INEXISTANTE` dans `api/system_core/system-core-api-paths.ts`.

### Propriété des générateurs de données

`test-data/builders.ts` ne contient que ce qui sert à **au moins deux modules**
(`unique`, `today`, `isoDate`…). Un générateur utilisé par un seul module
descend dans ce module :

- si le module a déjà un helper dédié au concept, l'y ajouter (les corps de
  requête comptables vivent dans
  `api/comptabilite_generale/helpers/compta-payload-helper.ts`) ;
- sinon, créer un `<module>-payload-builder.ts` à la racine du module.

Un module transverse comme `api/system_core/` ne possède aucun concept métier
propre : il n'a donc ni helper ni générateur à lui, et importe ceux du module
qui possède le concept qu'il exerce. Ne jamais déclarer un tel générateur
directement dans le fichier de spec.

Cela évite que le fichier partagé devienne le dépotoir des données de test de
tous les modules, et garde chaque générateur à côté du module qui possède
réellement le concept.

### Sécurité de typage

- **Séparer les types du code** : modèles, types et interfaces vivent dans
  `api/types/` (ou un `*.types.ts` du module), jamais déclarés à l'intérieur
  d'un générateur de données ou d'un fichier de spec. Un test importe le type
  et l'applique à ses `overrides` (`Partial<PlanBudgetaire>`).
- **Ni `any`, ni `!`** : le cast d'échappement et l'assertion de non-nullité
  masquent exactement les erreurs que `typecheck` doit attraper. Utiliser un
  cast typé (`as PageRecord<Ecriture>`) ou une garde explicite.

### Étiquettes de test

Convention à appliquer aux nouveaux tests (les specs existantes n'en portent pas
encore). Chaque test porte au moins une étiquette de chaque catégorie :

| Catégorie | Étiquettes |
| --- | --- |
| Portée | `@smoke`, `@regression`, `@e2e` |
| Couche | `@api`, `@ui` |
| Cycle de vie | `@health-check` (sonde de disponibilité), `@destructive` (exige `RUN_DESTRUCTIVE=true`) |

```typescript
test('crée un plan budgétaire valide', { tag: ['@smoke', '@api'] }, async ({ budgetPlanClient }) => {
  // ...
});
```

Elles se filtrent sans script dédié :

```bash
npx playwright test --project=api --grep "@smoke"
npx playwright test --project=api --grep "@health-check"
npx playwright test --project=api --grep-invert "@destructive"
```

### Tests de santé (`@health-check`)

Une sonde par module, qui vérifie seulement que le service répond — pas son
comportement métier. Elle sert à distinguer un déploiement cassé ou un backend
éteint d'une régression fonctionnelle, avant de lire 475 échecs de suite.

Ces tests ne portent que l'étiquette `@health-check` et n'appartiennent à aucune
campagne (`@smoke`, `@regression`) : ils doivent pouvoir tourner seuls, vite, et
sur n'importe quel environnement.

### Ajouter une suite authentifiée

Le module dérive `helpers/base-fixtures.ts` et injecte ses clients dans son
`<module>-fixtures.ts`. Deux points structurants :

- La fixture d'authentification est **de portée `worker`** : le login s'exécute
  une fois par processus de worker, pas une fois par test.
- La suite se protège par un `test.skip` explicite quand sa configuration est
  absente, avec un motif lisible, plutôt que d'échouer en cascade :

```typescript
test.skip(!env.backendSourcePath, 'BACKEND_SOURCE_PATH non renseigné');
```

### Règles de test

- Les tests sont indépendants ; ceux qui ont besoin de données existantes se
  mettent en `skip` explicite avec un motif lisible plutôt que d'échouer.
- Les assertions de statut passent par `expectStatusIn`, qui remonte le corps de
  la réponse dans le message d'échec — indispensable pour distinguer un 500
  fonctionnel d'un 400 de validation.
- Les familles de statuts acceptés (`BAD_REQUEST_STATUSES`, `NOT_FOUND_STATUSES`)
  sont larges à dessein : `GestionnaireErreursApi` ne normalise pas encore tous
  les cas, et les tests documentent le comportement réel sans le figer trop tôt.
- Les assertions de pagination passent par `expectValidPage`.
- Les traces, captures et vidéos ne sont conservées qu'en cas d'échec.

## Workflow Git

### Nommage des branches

```
{type}/{ticket}-{résumé-court}
```

Exemples : `feat/SOD-142-tests-tresorerie-change`,
`fix/SOD-87-pagination-ecritures`. Types utilisés : `feat`, `fix`, `chore`,
`docs`.

### Intégration dans `main`

`main` reste linéaire : pas de commit de merge. Avant d'ouvrir une demande de
fusion, remettre sa branche à jour par rebase plutôt que par merge :

```bash
git fetch origin main
git rebase origin/main
```

## État des tests UI

Aucun front n'est encore disponible : les specs de `ui/tests/` sont écrites mais
marquées `describe.skip`, et `ui/setup/auth.setup.ts` se met en `skip` si
`UI_BASE_URL` est injoignable. Pour les activer : renseigner `UI_BASE_URL`,
retirer les `.skip`, puis aligner les locators des Page Objects sur le vrai DOM
(de préférence via des `data-testid`).
