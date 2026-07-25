# TaskFlow — Application de formation DevSecOps

Gestionnaire de tâches (React + Node.js/Express + PostgreSQL) conçu comme **support de TP
DevSecOps**. Le métier est volontairement trivial : ce qui est enseigné, c'est la *tuyauterie*
(pipeline CI, conteneurisation durcie, Kubernetes, scans de sécurité). Fil rouge : une variable
d'environnement `APP_COLOR` qui change la couleur du front à chaque étape de la chaîne
(Dockerfile → `docker run -e` → env Kubernetes → ConfigMap).

## Parcours guidé (à suivre dans l'ordre)

1. [docs/01-lancer-sans-docker.md](docs/01-lancer-sans-docker.md) — lancer l'app à la main, pour
   comprendre ce qu'on va automatiser (et ressentir les frictions).
2. [docs/02-conteneuriser.md](docs/02-conteneuriser.md) — Docker et Compose : la stack en une
   commande, la config injectée au runtime (`APP_COLOR`).
3. [docs/03-pipeline-devops.md](docs/03-pipeline-devops.md) — la pipeline de retour rapide (lint,
   tests, qualité, build), lue pas à pas sur chaque pull request.
4. [docs/04-pipeline-devsecops.md](docs/04-pipeline-devsecops.md) — la porte complète : les mêmes
   jobs + les 5 tests de sécurité, l'intégration et l'E2E, à la fusion sur `main`.

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
| [.github/workflows/](.github/workflows/) | `Pipeline DevOps.yml` (PR) et `Pipeline DevSecOps.yml` (main) |
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

## Pipeline CI — deux fichiers, un modèle « retour rapide / porte complète »

Le dépôt contient **deux pipelines**, qui ne se déclenchent jamais sur le même événement :

| Pipeline | Se déclenche | Contient |
|---|---|---|
| [`Pipeline DevOps.yml`](.github/workflows/Pipeline%20DevOps.yml) | chaque **pull request** | 4 jobs : `lint`, `test`, `quality`, `build` |
| [`Pipeline DevSecOps.yml`](.github/workflows/Pipeline%20DevSecOps.yml) | fusion sur **`main`** (+ déclenchement manuel) | **la même base** + `integration`, 5 tests de sécurité, `e2e` |

La seconde n'est pas un pipeline différent : c'est la même base à laquelle on ajoute la sécurité.
Tous les jobs d'analyse partent **en parallèle** (fan-out), `build` les attend tous (`needs`,
fan-in), et `e2e` attend `build`.

| Job | Outil | Famille | Où |
|---|---|---|---|
| `lint` | ESLint | Qualité | les deux pipelines |
| `test` | Jest (backend) / Vitest (frontend) | Tests unitaires + couverture | les deux pipelines |
| `quality` | SonarQube (serveur jetable, zéro configuration) | Dette technique, non bloquant | les deux pipelines |
| `integration` | Jest + vraie PostgreSQL | Tests d'intégration | DevSecOps uniquement |
| `secrets` | Gitleaks | Détection de secrets (historique complet) | DevSecOps uniquement |
| `sca` | Trivy fs | **SCA** (dépendances) | DevSecOps uniquement |
| `sast` | Semgrep | **SAST** (code) | DevSecOps uniquement |
| `iac` | Trivy config | Manifests k8s | DevSecOps uniquement |
| `build` | Docker + Trivy image + SBOM (DevSecOps) + push GHCR | Build / scan / publication | les deux pipelines |
| `e2e` | Playwright | Acceptance (stack déployée) | DevSecOps uniquement |

Points de cours matérialisés dans le YAML : `fail-fast: false` (voir *toutes* les erreurs),
`cache-dependency-path` par composant, **SCA ≠ SAST ≠ IaC** (ce que j'importe / ce que j'écris / ce
que je configure), et surtout : le **push GHCR n'est jamais automatique depuis une pull request** —
sur `Pipeline DevOps.yml` il faut un déclenchement manuel depuis `main`, sur `Pipeline
DevSecOps.yml` il est conditionné à un push sur `main` qui a franchi les 5 portes de sécurité.

> **SonarQube sans configuration** : le job `quality` démarre son propre serveur SonarQube en
> conteneur, génère un token via l'API, analyse, puis publie le Quality Gate et les métriques clés
> dans le résumé du run (`Summary`) — le serveur disparaît avec le job. Pas de compte ni de secret à
> créer. Détail dans [docs/03-pipeline-devops.md](docs/03-pipeline-devops.md).

## Déroulé pédagogique du TP

L'idée : une pipeline **verte** n'apprend rien. On fait donc échouer chaque outil, puis on corrige.
Le code principal reste sain (pipeline verte) ; les vulnérabilités vivent dans des dossiers isolés
(`demo-insecure/`, `k8s-insecure/`) que les pipelines ne scannent jamais automatiquement. Détail
complet dans [CORRECTIONS.md](CORRECTIONS.md).

1. **Ouvrir une pull request.** `Pipeline DevOps.yml` s'exécute : lint, tests, qualité, build — le
   retour rapide, sans les scans de sécurité (ce n'est pas leur rôle sur ce pipeline).
2. **Faire échouer chaque outil de sécurité, à la main** (les dossiers de démo ne sont scannés que
   volontairement, jamais par la CI) :
   ```bash
   trivy fs --scanners vuln --severity HIGH,CRITICAL demo-insecure/   # SCA : lodash 4.17.4
   semgrep scan --config p/javascript --config p/nodejs demo-insecure/ # SAST : eval(), SQL concat
   trivy config --severity HIGH,CRITICAL k8s-insecure/                 # IaC : 6 alertes HIGH
   ```
3. **Corriger** en s'appuyant sur les versions saines (`backend/`, `k8s/`) et sur CORRECTIONS.md.
4. **Fusionner sur `main`.** `Pipeline DevSecOps.yml` s'exécute : la porte complète — les 5 tests de
   sécurité doivent tous être verts pour que l'image parte sur GHCR. C'est le moment clé du cours :
   ce qui était juste un retour rapide sur la PR devient une porte bloquante à la livraison.

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
- **CI** : lint + tests + SCA + SAST + secrets + IaC + scan d'images + SBOM, gates bloquantes
  (`Pipeline DevSecOps.yml`), push GHCR jamais automatique depuis une pull request, permissions
  minimales par job.

Points volontairement simplifiés (exercices possibles) : JWT en `localStorage` (vs cookie
`httpOnly`), secrets k8s committés pour la démo, pas de TLS.
