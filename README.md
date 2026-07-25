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
| [.github/workflows/](.github/workflows/) | `Pipeline DevOps.yml` — lint, tests, qualité, build sur chaque pull request |
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

## Pipeline CI

Le fichier [`Pipeline DevOps.yml`](.github/workflows/Pipeline%20DevOps.yml) se déclenche à chaque
**pull request** : c'est le retour rapide pendant que tu développes.

| Job | Outil | Famille |
|---|---|---|
| `test-qualite` | ESLint | Qualité |
| `test-unitaire` | Jest (backend) / Vitest (frontend) | Test, avec couverture |
| `quality` | SonarQube (serveur jetable, zéro configuration) | Qualité, non bloquant |
| `build` | Docker + GHCR | Build |

Enchaînement : `test-qualite` et `test-unitaire` partent en parallèle (chacun décliné par
composant via `strategy: matrix`), `quality` les attend (elle a besoin de leurs rapports de
couverture), `build` attend `quality`.

> **SonarQube sans configuration** : le job `quality` démarre son propre serveur SonarQube en
> conteneur, génère un token via l'API, analyse, puis publie le Quality Gate et les métriques clés
> dans le résumé du run (`Summary`) — le serveur disparaît avec le job. Pas de compte ni de secret à
> créer. Détail dans [docs/03-pipeline-devops.md](docs/03-pipeline-devops.md).

Le **push vers GHCR n'est jamais automatique depuis une pull request** : il faut un déclenchement
manuel (`workflow_dispatch`) depuis `main` pour publier une image via cette pipeline.

Détail pas à pas de chaque job : [docs/03-pipeline-devops.md](docs/03-pipeline-devops.md).
