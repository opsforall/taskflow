# TaskFlow — Application de formation DevSecOps

Gestionnaire de tâches complet (React + Node.js/Express + PostgreSQL) conçu comme support de
formation : pipeline CI DevSecOps sur GitHub Actions, conteneurisation durcie, déploiement
Kubernetes avec ConfigMap et Secret, et une variable d'environnement `APP_COLOR` qui change la
couleur du front à chaque étape de la chaîne (Dockerfile → `docker run -e` → env Kubernetes →
ConfigMap).

## Architecture

```
                        ┌──────────────────────────────────────────────┐
                        │                 Kubernetes                   │
 navigateur ── Ingress ─┤  ┌──────────┐   ┌─────────┐   ┌───────────┐  │
                        │  │ frontend │──▶│ backend │──▶│ postgres  │  │
                        │  │ nginx    │   │ express │   │           │  │
                        │  │ (:8080)  │   │ (:3000) │   │ (:5432)   │  │
                        │  └────▲─────┘   └───▲─────┘   └─────▲─────┘  │
                        │       │             │               │        │
                        │   ConfigMap     ConfigMap        Secret      │
                        │   APP_COLOR      + Secret     POSTGRES_PWD   │
                        └──────────────────────────────────────────────┘
```

- **frontend/** — React 18 + Vite, servi par nginx *unprivileged* (multi-stage build).
  Le nginx du pod sert la SPA **et** relaie `/api` vers le backend (pas de CORS).
- **backend/** — Express : auth JWT (bcrypt, rate-limiting), CRUD de tâches, requêtes SQL
  paramétrées, endpoints de probes `/api/health` (liveness) et `/api/health/ready` (readiness).
- **PostgreSQL 16** — schéma auto-initialisé au démarrage du backend.

## La variable APP_COLOR (fil rouge de la formation)

Le thème du front (bleu, rouge, jaune, vert, violet, teal) est piloté par la variable
d'environnement `APP_COLOR`, lue **au démarrage du conteneur** — pas au build. Le script
[frontend/docker/40-inject-env.sh](frontend/docker/40-inject-env.sh) génère `/tmp/env.js`
(`window.__ENV__`), que nginx sert sur `/env.js` et que React lit avant le rendu
([frontend/src/theme.js](frontend/src/theme.js)). La sidebar affiche la couleur active.

Une même image → quatre façons de changer la couleur :

| Niveau | Où | Comment |
|---|---|---|
| 1. Défaut de l'image | [frontend/Dockerfile](frontend/Dockerfile) | `ENV APP_COLOR=blue` |
| 2. Docker | terminal | `docker run -e APP_COLOR=red -p 8080:8080 taskflow-frontend` |
| 3. Compose | [docker-compose.yml](docker-compose.yml) | `APP_COLOR=yellow docker compose up` |
| 4. Kubernetes | [k8s/30-frontend-configmap.yaml](k8s/30-frontend-configmap.yaml) | éditer la ConfigMap puis `kubectl rollout restart` |

Démo Kubernetes :

```bash
# via la ConfigMap (recommandé)
kubectl -n taskflow patch configmap frontend-config -p '{"data":{"APP_COLOR":"purple"}}'
kubectl -n taskflow rollout restart deployment/frontend

# ou surcharge directe de la variable sur le Deployment
kubectl -n taskflow set env deployment/frontend APP_COLOR=green
```

## Démarrage rapide

### Avec Docker Compose (le plus simple)

```bash
docker compose up --build
# front : http://localhost:8080   —   API : http://localhost:3000/api/health

# changer la couleur :
APP_COLOR=red docker compose up --build          # bash
$env:APP_COLOR="red"; docker compose up --build  # PowerShell
```

### En développement local (Node ≥ 20 requis)

```bash
# base de données
docker run -d --name taskflow-db -p 5432:5432 \
  -e POSTGRES_USER=taskflow -e POSTGRES_PASSWORD=taskflow -e POSTGRES_DB=taskflow \
  postgres:16-alpine

# backend (port 3000)
cd backend && npm install && npm run dev

# frontend (port 5173, proxy /api → 3000)
cd frontend && npm install && npm run dev
```

### Tests

```bash
cd backend && npm test    # Jest + Supertest (DB mockée, aucun PostgreSQL requis)
cd frontend && npm test   # Vitest (logique du thème APP_COLOR)
```

## Pipeline CI ([.github/workflows/ci.yml](.github/workflows/ci.yml))

| Job | Outil | Famille | Bloquant |
|---|---|---|---|
| `backend-test` | Jest + Supertest | Tests unitaires | ✅ |
| `backend-test` | npm audit | SCA (dépendances) | ✅ (HIGH+) |
| `frontend-test` | Vitest + build Vite | Tests + build | ✅ |
| `secrets-scan` | Gitleaks | Détection de secrets | ✅ |
| `codeql` | CodeQL | SAST (analyse statique) | résultats dans l'onglet Security |
| `docker` | Trivy | Scan d'images (OS + deps) | ✅ (HIGH/CRITICAL corrigeables) |

Les images ne sont **poussées vers GHCR qu'après** réussite des tests et du scan Trivy, et
uniquement sur `push main` (jamais depuis une PR). [Dependabot](.github/dependabot.yml) ouvre des
PRs hebdomadaires pour les dépendances npm, les images Docker et les actions GitHub.

## Déploiement Kubernetes

```bash
# 1. (recommandé) régénérer les secrets au lieu des valeurs de démo committées
kubectl apply -f k8s/00-namespace.yaml
kubectl -n taskflow create secret generic postgres-secret \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -hex 16)"
kubectl -n taskflow create secret generic backend-secret \
  --from-literal=DB_PASSWORD="<même valeur que POSTGRES_PASSWORD>" \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)"

# 2. tout appliquer (les fichiers sont numérotés dans l'ordre d'application)
kubectl apply -f k8s/

# 3. vérifier
kubectl -n taskflow get pods
kubectl -n taskflow port-forward svc/frontend 8080:80   # → http://localhost:8080
```

> **Images GHCR** : les manifests pointent vers `ghcr.io/modhafferraihane/taskflow-*:latest`.
> Rends les packages publics (Settings du package → Change visibility), ou crée un
> `imagePullSecret` : `kubectl -n taskflow create secret docker-registry ghcr-pull
> --docker-server=ghcr.io --docker-username=<user> --docker-password=<PAT read:packages>`
> puis référence-le dans les Deployments (`spec.template.spec.imagePullSecrets`).

## Mesures de sécurité illustrées

- **Application** : hash bcrypt, JWT expirable, rate-limiting sur l'auth, messages d'erreur sans
  énumération de comptes, validation par listes blanches, SQL 100 % paramétré, helmet,
  body limité à 10 ko, pas de stack trace côté client, fail-fast si `JWT_SECRET` absent en prod.
- **Images** : multi-stage, base alpine/unprivileged, utilisateur non-root (`node` / `nginx`),
  `.dockerignore`, dépendances de prod uniquement, healthchecks.
- **Kubernetes** : Secret vs ConfigMap, `runAsNonRoot`, `readOnlyRootFilesystem`,
  `capabilities: drop ALL`, probes, requests/limits, DB non exposée (ClusterIP).
- **CI** : SCA + SAST + secrets + scan d'images bloquants, push d'images conditionné,
  permissions GitHub Actions minimales (`contents: read` par défaut).

Points discutables en formation (volontairement simplifiés) : JWT stocké en `localStorage`
(vs cookie `httpOnly`), secrets k8s committés pour la démo, pas de NetworkPolicy ni de TLS —
autant d'exercices d'amélioration possibles.
