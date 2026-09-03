# Kiwi TCMS + Allure — intégration au dépôt AQA Sodepa

Ce document décrit l'ajout, au socle Playwright existant, de :

- **Kiwi TCMS** (local, Docker) — gestion des cas, plans, runs, exigences, assignation ;
- **Allure Report** — rapport technique : steps, captures, traces, historique ;
- **`scripts/kiwi-report.mjs`** — pont automatique Playwright → Kiwi TCMS.

```
Kiwi TCMS  ── Test Cases / Plans / Runs / Exigences
     ▲
     │  statuts PASS / FAIL / WAIVED  (scripts/kiwi-report.mjs, API JSON-RPC)
     │
Playwright ── projets : api, ui-setup, ui-chromium
     │
     ▼
Allure Report ── steps, captures, logs, historique
```

Rien n'a été retiré du socle existant : les reporters `list`, `html` et `junit`
restent en place, deux reporters ont été ajoutés (`json` et `allure`).

---

## 1. Prérequis supplémentaires

| Outil | Pourquoi | Installation |
|---|---|---|
| Docker Desktop | fait tourner Kiwi TCMS | https://www.docker.com/products/docker-desktop/ |
| Java 17+ | requis par la CLI Allure | `winget install Microsoft.OpenJDK.21` |

Vérification :

```powershell
.\scripts\check-prereqs.ps1
```

> Si PowerShell bloque le script :
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

---

## 2. Démarrer Kiwi TCMS

```powershell
cd kiwi
docker compose up -d
cd ..
docker exec -it kiwi_web /Kiwi/manage.py initial_setup
```

La dernière commande crée le compte superutilisateur (nom, email, mot de passe) —
ce sont les identifiants à mettre dans `.env`.

Interface : **https://localhost:8443** (certificat auto-signé → « Paramètres
avancés / Continuer vers localhost », normal en local).

| Commande | Effet |
|---|---|
| `docker compose -f kiwi/docker-compose.yml logs -f web` | suivre les logs |
| `docker compose -f kiwi/docker-compose.yml stop` | arrêter (données conservées) |
| `docker compose -f kiwi/docker-compose.yml down -v` | tout supprimer, données comprises |

---

## 3. Configuration

Les nouvelles clés ont été ajoutées à `.env.example` et à ton `.env` :

```ini
TCMS_API_URL=https://localhost:8443/json-rpc/
TCMS_USERNAME=admin
TCMS_PASSWORD=            # a renseigner
TCMS_INSECURE_TLS=true    # certificat auto-signe en local
TCMS_PRODUCT=Sodepa ERP
TCMS_PREFIX=[AQA]
TCMS_EXCLUDE_PROJECTS=ui-setup   # le projet d'auth n'est pas un cas de test
```

`TCMS_PRODUCT_VERSION` et `TCMS_BUILD` sont facultatifs : sans eux, le script
utilise **la branche git courante** comme version et **le commit court +
horodatage** comme build. Chaque exécution est donc traçable.

Vérifie la connexion :

```powershell
npm run kiwi:check
```

---

## 4. Utilisation

```powershell
.\scripts\run-qa.ps1                  # tous les projets
.\scripts\run-qa.ps1 -Project api
.\scripts\run-qa.ps1 -Grep "@smoke"
.\scripts\run-qa.ps1 -NoKiwi -OpenReport
```

Ou étape par étape :

| Commande | Effet |
|---|---|
| `npm test` | Playwright → `test-results/` + `allure-results/` |
| `npm run allure:generate` | construit `allure-report/` |
| `npm run allure:open` | ouvre le rapport |
| `npm run allure:serve` | génère + ouvre en une commande |
| `npm run kiwi:dry` | montre ce qui serait poussé, sans rien écrire |
| `npm run kiwi:push` | pousse réellement dans Kiwi |
| `npm run kiwi:check` | teste la connexion à Kiwi |
| `npm run kiwi:sync` | crée dans Kiwi les Test Cases de tous les tests, **sans les exécuter** |

### Peupler Kiwi sans lancer les tests

`scripts/kiwi-sync-cases.mjs` inventorie les tests (`playwright test --list` —
aucun test n'est exécuté, aucun Test Run créé) et crée les Test Cases
correspondants dans Kiwi, rattachés au Test Plan. Utile pour remplir le
référentiel avant une campagne, relire les cas, les assigner.

```powershell
npm run kiwi:sync                                   # tous les projets
node scripts/kiwi-sync-cases.mjs --project api      # un seul projet
node scripts/kiwi-sync-cases.mjs --grep "@smoke"    # filtre par tag
node scripts/kiwi-sync-cases.mjs --dry-run          # simulation
```

L'opération est idempotente : un second passage ne recrée rien, il signale les
cas déjà présents. Les cas créés portent le drapeau *is_automated* et une note
indiquant le fichier source.

Les scripts existants (`test:api`, `test:ui`, `report`, `typecheck`…) sont
inchangés.

---

## 5. Ce que fait le pont

`scripts/kiwi-report.mjs` lit `test-results/results.json` et appelle l'API
JSON-RPC de Kiwi. Sans dépendance npm (modules Node natifs uniquement).

1. `Auth.login`
2. **Product → Version → Build** créés si absents
3. **Test Plan** créé ou réutilisé (`TCMS_PLAN_ID` pour cibler un plan précis)
4. **Test Run** créé (`TCMS_RUN_ID` pour écrire dans un run existant)
5. pour chaque test :
   - **Test Case** retrouvé ou créé (marqué `is_automated`),
   - rattaché au plan puis au run → **Test Execution**,
   - statut mis à jour,
   - commentaire : projet, fichier, durée, erreur, lien Allure.

### Nommage des cas

Le *summary* du cas Kiwi = `[projet] Suite > Titre du test`, par exemple :

```
[api] Comptabilité générale > Une écriture déséquilibrée est refusée
[ui-chromium] Connexion > Un compte verrouillé ne peut pas se connecter
```

Le préfixe projet évite les collisions entre un test API et un test UI portant
le même titre. Pour le désactiver : `TCMS_PREFIX_PROJECT=false`.

### Correspondance des statuts

| Playwright | Kiwi TCMS |
|---|---|
| `passed` | PASSED |
| `failed` | FAILED |
| `timedOut` | ERROR |
| `interrupted` | BLOCKED |
| `skipped` | WAIVED |

### Rattacher un test à un cas Kiwi existant

Tague le titre avec `@TC-<id>` :

```ts
test('@smoke @TC-42 Une écriture déséquilibrée est refusée', async ({ request }) => { ... });
```

Le résultat va alors sur le cas **#42** au lieu d'en créer un nouveau. C'est la
méthode recommandée quand les cas ont d'abord été rédigés dans Kiwi.

---

## 6. Workflow conseillé

1. **Kiwi** : exigences, Test Plans, Test Cases (manuels et à automatiser),
   assignation aux testeurs.
2. **Playwright** : automatisation ; tag `@TC-<id>` sur les tests correspondant
   à un cas déjà rédigé.
3. **Chaque exécution** : `run-qa.ps1` → Allure pour le détail technique, Kiwi
   pour le suivi projet (build, taux de réussite, historique).
4. **Bugs** : *Admin → Bug trackers* dans Kiwi pour relier le dépôt GitHub
   `sodepa-aqa` et ouvrir un ticket depuis une exécution en échec.

---

## 7. Dépannage

| Symptôme | Solution |
|---|---|
| `port is already allocated` | change les ports dans `kiwi/docker-compose.yml` (ex. `9443:8443`) et `TCMS_API_URL` |
| `Réponse non-JSON de ...` | `TCMS_API_URL` doit finir par `/json-rpc/` |
| `Connexion impossible` | conteneur arrêté : `docker compose -f kiwi/docker-compose.yml ps` |
| `self signed certificate` | garde `TCMS_INSECURE_TLS=true` en local |
| `Auth.login -> ...` | identifiants faux : `docker exec -it kiwi_web /Kiwi/manage.py createsuperuser` |
| Allure : `java not found` | installe un JDK 17+ puis rouvre le terminal |
| `Rapport Playwright introuvable` | lance `npm test` avant `npm run kiwi:push` |
| Kiwi ne démarre pas | `docker compose -f kiwi/docker-compose.yml logs web` (la base met ~30 s au 1er lancement) |

## 8. Sauvegarde

```powershell
docker exec kiwi_db mysqldump -u kiwi -pkiwi kiwi > kiwi-backup.sql
Get-Content kiwi-backup.sql | docker exec -i kiwi_db mysql -u kiwi -pkiwi kiwi
```

---

## Liens

- Kiwi TCMS — https://kiwitcms.org · [doc Docker](https://kiwitcms.readthedocs.io/en/stable/installing_docker.html) · [API RPC](https://kiwitcms.readthedocs.io/en/stable/modules/tcms.rpc.api.html)
- Allure + Playwright — https://allurereport.org/docs/playwright/
