# TaskFlow — Application de formation DevSecOps

Gestionnaire de tâches (React + Node.js/Express + PostgreSQL) conçu comme **support de TP
DevSecOps**. Le métier est volontairement trivial : ce qui est enseigné, c'est la *tuyauterie*
(pipeline CI, conteneurisation durcie, Kubernetes, scans de sécurité). Fil rouge : une variable
d'environnement `APP_COLOR` qui change la couleur du front à chaque étape de la chaîne
(Dockerfile → `docker run -e` → env Kubernetes → ConfigMap).

## Architecture

```
                        ┌──────────────────────────────────────────────┐
                        │                 Kubernetes                    │
 navigateur ── Ingress ─┤  ┌──────────┐   ┌─────────┐   ┌───────────┐   │
                        │  │ frontend │──▶│ backend │──▶│ postgres  │   │
                        │  │ nginx    │   │ express │   │StatefulSet│   │
                        │  │ (:8080)  │   │ (:3000) │   │ (:5432)   │   │
                        │  └────▲─────┘   └───▲─────┘   └─────▲─────┘   │
                        │   ConfigMap     ConfigMap        Secret       │
                        │   APP_COLOR      + Secret     POSTGRES_PWD     │
                        │        + NetworkPolicy (DB ← backend seul)     │
                        └──────────────────────────────────────────────┘
```

## Structure du monorepo

| Dossier / fichier | Rôle |
|---|---|
| [frontend/](frontend/) | React 18 + Vite, servi par nginx *unprivileged* |
| [backend/](backend/) | Node.js + Express, auth JWT, CRUD tâches, PostgreSQL |
| [e2e/](e2e/) | Tests d'acceptance Playwright (stack déployée) |
| [k8s/](k8s/) | Manifests Kubernetes **durcis** (version de référence) |
| [k8s-insecure/](k8s-insecure/) | Mêmes manifests **volontairement vulnérables** (démo) |
| [demo-insecure/](demo-insecure/) | Code + dépendance volontairement vulnérables (démo SAST/SCA) |
| [.github/workflows/](.github/workflows/) | `ci.yml` (bloquant) et `ci-permissif.yml` (début de module) |
| [docker-compose.yml](docker-compose.yml) | Stack complète en local |
| [.env.example](.env.example) | Variables d'environnement de démo (copier en `.env`) |
| [CORRECTIONS.md](CORRECTIONS.md) | Guide formateur : chaque vulnérabilité et son correctif |

## La variable APP_COLOR (fil rouge)

Le thème du front (blue, red, yellow, green, purple, teal) est piloté par `APP_COLOR`, lue **au
démarrage du conteneur**, pas au build. Le script
[frontend/docker/40-inject-env.sh](frontend/docker/40-inject-env.sh) génère `/tmp/config.js`
(`window.__ENV__`), que nginx sert sur `/config.js` et que React lit avant le rendu
([frontend/src/theme.js](frontend/src/theme.js)). C'est ce mécanisme (config au runtime, pas au
build) qui rend possible la démo du ConfigMap Kubernetes.

Une même image, quatre façons de changer la couleur :

| Niveau | Où | Comment |
|---|---|---|
| 1. Défaut de l'image | [frontend/Dockerfile](frontend/Dockerfile) | `ENV APP_COLOR=blue` |
| 2. Docker | terminal | `docker run -e APP_COLOR=red -p 8080:8080 taskflow-frontend` |
| 3. Compose | [docker-compose.yml](docker-compose.yml) | `APP_COLOR=yellow docker compose up` |
| 4. Kubernetes | [k8s/30-frontend-configmap.yaml](k8s/30-frontend-configmap.yaml) | éditer la ConfigMap puis `kubectl rollout restart` |

## Démarrage rapide

### Docker Compose (le plus simple)

```bash
cp .env.example .env        # secrets de dev (facultatif : des valeurs de repli existent)
docker compose up --build
# front : http://localhost:8080   —   API : http://localhost:3000/api/health

APP_COLOR=red docker compose up --build          # bash
$env:APP_COLOR="red"; docker compose up --build  # PowerShell
```

### Développement local (Node 22)

```bash
docker run -d --name taskflow-db -p 5432:5432 \
  -e POSTGRES_USER=taskflow -e POSTGRES_PASSWORD=taskflow -e POSTGRES_DB=taskflow \
  postgres:16.4-alpine

cd backend && npm install && npm run dev     # port 3000
cd frontend && npm install && npm run dev    # port 5173, proxy /api → 3000
```

### Tests (trois niveaux)

```bash
# unitaires (base MOCKÉE, aucun PostgreSQL requis)
cd backend && npm test
cd frontend && npm test

# intégration (API contre une VRAIE PostgreSQL)
docker run -d --name it-db -p 5432:5432 -e POSTGRES_USER=taskflow \
  -e POSTGRES_PASSWORD=taskflow -e POSTGRES_DB=taskflow postgres:16.4-alpine
cd backend && DB_HOST=localhost DB_USER=taskflow DB_PASSWORD=taskflow DB_NAME=taskflow \
  JWT_SECRET=test npm run test:integration

# acceptance E2E (stack déployée + navigateur)
docker compose up -d --build
cd e2e && npm install && npx playwright install --with-deps chromium && npm test
```

## Pipeline CI (fan-out / fan-in)

Deux fichiers : [ci.yml](.github/workflows/ci.yml) (**version bloquante**, fin de module) et
[ci-permissif.yml](.github/workflows/ci-permissif.yml) (**version permissive**, début de module,
déclenchement manuel). Architecture : tous les jobs d'analyse tournent **en parallèle** (fan-out),
puis `build` les attend tous (`needs`, fan-in), et `e2e` attend `build`.

| Job | Outil | Famille | Matrix |
|---|---|---|---|
| `lint` | ESLint + Prettier | Qualité | frontend, backend |
| `test` | Jest + Supertest / Vitest | Tests unitaires (+ couverture, non bloquante) | frontend, backend |
| `integration` | Jest + Supertest + PostgreSQL | Tests d'intégration | — |
| `secrets` | Gitleaks | Détection de secrets | — |
| `sca` | Trivy fs | **SCA** (dépendances) | frontend, backend |
| `sast` | Semgrep | **SAST** (code) | frontend, backend |
| `iac-scan` | Trivy config | Manifests k8s | — |
| `build` | Docker + Trivy image | Build + scan + push GHCR | frontend, backend |
| `e2e` | Playwright | Acceptance (stack déployée) | — |

Points de cours matérialisés dans le YAML : `fail-fast: false` (voir *toutes* les erreurs),
`cache-dependency-path` par composant, **SCA ≠ SAST**, et surtout : le **build et le scan tournent
aussi sur les Pull Requests**, seul le **push GHCR** est conditionné à `main`.

> **SARIF / onglet Security** : les scans produisent du SARIF et tentent de le publier dans
> l'onglet Security. Cet upload nécessite un dépôt **public** ou **GitHub Advanced Security** ;
> sur un dépôt privé sans GHAS, l'étape est en `continue-on-error` (elle n'échoue pas la pipeline,
> mais l'onglet Security ne se remplit pas). Le *gate* bloquant, lui, fonctionne partout.

## Déroulé pédagogique du TP

L'idée : une pipeline **verte** n'apprend rien. On fait donc échouer chaque outil, puis on corrige.
Le code principal reste sain (pipeline verte) ; les vulnérabilités vivent dans des dossiers isolés
que la pipeline ne scanne pas. Détail complet dans [CORRECTIONS.md](CORRECTIONS.md).

1. **Début de module — pipeline permissive.** Lancer `ci-permissif.yml` (Actions → Run workflow).
   Les scans affichent des alertes sans bloquer : on observe ce que chaque outil détecte.
2. **Faire échouer chaque outil, à la main :**
   ```bash
   trivy fs --scanners vuln --severity HIGH,CRITICAL demo-insecure/   # SCA : lodash 4.17.4
   semgrep scan --config p/javascript --config p/nodejs demo-insecure/ # SAST : eval(), SQL concat
   trivy config --severity HIGH,CRITICAL k8s-insecure/                 # IaC : 6 alertes HIGH
   ```
3. **Corriger** en s'appuyant sur les versions saines (`backend/`, `k8s/`) et sur CORRECTIONS.md.
4. **Fin de module — pipeline bloquante.** `ci.yml` : tout doit être vert. Le passage permissif →
   bloquant est le moment clé du cours.

## Déploiement Kubernetes

```bash
# 1. namespace + secrets (régénérés plutôt que les valeurs de démo committées)
kubectl apply -f k8s/00-namespace.yaml
kubectl -n taskflow create secret generic postgres-secret \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -hex 16)"
kubectl -n taskflow create secret generic backend-secret \
  --from-literal=DB_PASSWORD="<même valeur que POSTGRES_PASSWORD>" \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)"

# 2. tout appliquer (fichiers numérotés dans l'ordre d'application)
kubectl apply -f k8s/

# 3. vérifier
kubectl -n taskflow get pods
kubectl -n taskflow port-forward svc/frontend 8080:80   # → http://localhost:8080
```

Ressources : Namespace, ConfigMap (APP_COLOR, BACKEND_URL), Secret (mot de passe DB, JWT),
Deployments frontend/backend (2 replicas), **StatefulSet PostgreSQL** (+ PVC via
`volumeClaimTemplates`), Services ClusterIP + Service headless pour la base, Ingress, et une
**NetworkPolicy** qui réserve l'accès à la base au seul backend.

> **Images GHCR** : la CI publie sous `ghcr.io/opsforall/taskflow-*` avec les tags `:<sha>`,
> `:1.0.0` et `:latest`. Les Deployments référencent `:1.0.0` (tag versionné, jamais `:latest`).
> Par défaut les packages GHCR sont **privés** : rends-les publics **une fois** (Package settings →
> Change visibility → Public) et ils le restent pour les push suivants, OU crée un `imagePullSecret`
> (voir plus bas). Il n'existe pas d'API pour basculer la visibilité depuis la pipeline.
>
> **NetworkPolicy** : appliquée uniquement si le cluster a un CNI compatible (Calico, Cilium...).

## Mesures de sécurité illustrées

- **Application** : hash bcrypt, JWT expirable, rate-limiting, non-énumération de comptes,
  validation par listes blanches, SQL 100 % paramétré, helmet, body limité, fail-fast si
  `JWT_SECRET` absent en prod.
- **Images** : multi-stage, base alpine/unprivileged, non-root (`node` / `nginx`), retrait de
  npm/yarn de l'image finale (surface d'attaque), healthchecks, tags précis.
- **Compose** : `read_only`, `no-new-privileges`, port PostgreSQL non exposé, secrets via `.env`.
- **Kubernetes** : Secret vs ConfigMap, `runAsNonRoot`, `runAsUser` explicite,
  `readOnlyRootFilesystem`, `allowPrivilegeEscalation: false`, `capabilities: drop ALL`,
  `seccompProfile: RuntimeDefault`, requests/limits, probes, NetworkPolicy, DB non exposée.
- **CI** : lint + tests + SCA + SAST + secrets + IaC + scan d'images, gates bloquantes (ci.yml),
  push conditionné à `main`, permissions minimales, SARIF vers l'onglet Security.

Points volontairement simplifiés (exercices possibles) : JWT en `localStorage` (vs cookie
`httpOnly`), secrets k8s committés pour la démo, pas de TLS.
