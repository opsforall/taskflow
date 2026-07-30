# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

TaskFlow is a **personal DevSecOps training project** (not a product): a trivial task-manager
(React + Vite / Express / PostgreSQL) whose real purpose is to teach the *tooling* — CI pipelines,
hardened containers, Kubernetes, security scanning. The business logic is deliberately simple; the
interesting parts are the Dockerfiles, the two GitHub Actions pipelines, and the k8s manifests.

A running thread ties the training steps together: an `APP_COLOR` env var changes the frontend's
theme, injected at **container runtime** (not build time) at each level — Dockerfile default →
`docker run -e` → Compose → Kubernetes ConfigMap. See "APP_COLOR mechanism" below before touching
`frontend/docker/40-inject-env.sh` or `frontend/src/theme.js`.

The guided walkthrough lives in `docs/01-lancer-sans-docker.md` → `02-conteneuriser.md` →
`03-pipeline-devops.md` → `04-pipeline-devsecops.md`, read in that order — the last two walk
`.github/workflows/Pipeline DevOps.yml` and `Pipeline DevSecOps.yml` step by step. `README.md` has
additional detail but the exact job names/structure churn frequently (job keys have been renamed
and merged several times) — trust the workflow files and the two `docs/0*-pipeline-*.md` pages over
README's job tables when they disagree.

## Commands

Node 22 is required for both `frontend/` and `backend/`. Each has its own `package.json` /
`package-lock.json` — always `npm ci`/run scripts from inside that directory, not the repo root.

```bash
# install (frontend/ and backend/ are independent)
cd backend && npm ci
cd frontend && npm ci

# lint (ESLint flat config, --max-warnings=0 — a warning fails the command)
npm run lint

# format (Prettier)
npm run format          # write
npm run format:check    # check only (what CI runs)

# unit tests — backend: Jest+Supertest, DB mocked. frontend: Vitest (NOT Jest,
# despite the Jest-compatible describe/it/expect API) — its only test today is
# frontend/src/theme.test.js; no React Testing Library is installed yet.
npm test
npm run test:coverage          # adds lcov coverage report

# single test file / single test name
npx jest tests/tasks.test.js                    # backend
npx jest -t "returns 401 without a token"       # backend, by name
npx vitest run src/theme.test.js                # frontend

# backend integration tests — hit a REAL PostgreSQL, separate Jest config
# (jest.integration.config.js), requires a running Postgres on 5432:
docker run -d --name it-db -p 5432:5432 \
  -e POSTGRES_USER=taskflow -e POSTGRES_PASSWORD=taskflow -e POSTGRES_DB=taskflow \
  postgres:16.4-alpine
cd backend && DB_HOST=localhost DB_USER=taskflow DB_PASSWORD=taskflow DB_NAME=taskflow \
  JWT_SECRET=test npm run test:integration

# dev servers
cd backend && npm run dev     # node --watch, port 3000
cd frontend && npm run dev    # vite, port 5173, proxies /api -> localhost:3000

# full stack locally
docker compose up --build                          # front :8080, api :3000/api/health
APP_COLOR=red docker compose up --build             # bash
$env:APP_COLOR="red"; docker compose up --build     # PowerShell

# e2e (Playwright, against the deployed stack — needs docker compose running)
cd e2e && npm ci && npx playwright install --with-deps chromium && npm test
```

There is no root-level `package.json` / build / test command — always operate inside the relevant
component directory.

## Architecture

### Monorepo layout

| Path | Role |
|---|---|
| `frontend/` | React 18 + Vite, built and served by *unprivileged* nginx |
| `backend/` | Express API: JWT auth, task CRUD, PostgreSQL |
| `e2e/` | Playwright acceptance tests, run against the deployed stack |
| `k8s/` | Hardened Kubernetes manifests — the reference version |
| `kubernetes/` | Guided Killercoda workshop, `lab00/`…`lab07/` — one object per lab, exercise/solution/test. Deliberately *un*-hardened (minimal manifests so the object under study stays readable); **not** covered by the `iac` scan, which is pinned to `scan-ref: k8s`. Each lab's `solution.yaml` must stay identical to the YAML block in its `README.md`. |
| `k8s-insecure/` | Same manifests, **deliberately vulnerable** — scan-and-fix demo, excluded from CI |
| `demo-insecure/` | Deliberately vulnerable code + dependency — SAST/SCA demo, excluded from CI |
| `.github/workflows/` | The two pipelines — see below |
| `CORRECTIONS.md` | Instructor's guide: every planted vulnerability and its fix |

### Backend

- All config comes from env vars, centralized in `backend/src/config.js` (12-factor). Defaults are
  dev-only fallbacks; `backend/src/index.js` **fails fast** if `NODE_ENV=production` and
  `JWT_SECRET` is unset.
- Auth is stateless JWT (`backend/src/middleware/auth.js` verifies `Authorization: Bearer <token>`,
  no refresh tokens). The frontend stores the token in `localStorage` (`frontend/src/api.js`) —
  known simplification vs. an `httpOnly` cookie, listed as an intentional exercise in the README.
- `backend/src/app.js` exposes `/api/health` (liveness) and `/api/health/ready` (readiness, checks
  the DB) — these are what both Kubernetes probes and the CI/E2E "wait for stack" loops poll.
- `waitForDatabase()` in `index.js` retries schema init for ~45s before giving up — the DB container
  in Compose/k8s can take a few seconds to become reachable.

### Frontend

- `frontend/docker/40-inject-env.sh` (nginx entrypoint script) renders `/tmp/config.js`
  (`window.__ENV__`) from the `APP_COLOR`/`BACKEND_URL` env vars **at container start**, served at
  `/config.js`; `frontend/src/theme.js` reads it before render. This runtime-injection pattern (vs.
  baking config into the build) is what makes the Kubernetes ConfigMap demo meaningful — don't
  "simplify" it into a build-time env var without understanding why it's there.
- In dev, Vite proxies `/api` to `localhost:3000` (`frontend/vite.config.js`); in prod, nginx does
  the equivalent via `default.conf.template` + `BACKEND_URL`.

### The two CI pipelines (`.github/workflows/`)

Two files, deliberately kept in sync, following a **fast-feedback / full-gate** split. They never
trigger on the same event — running both together would race on the same GHCR tags.

- **`Pipeline DevOps.yml`** — runs on pull requests. The base: `lint` (ESLint) → `test`
  (Jest/Vitest, uploads coverage as an artifact) → `quality` (SonarQube) → `build` (Docker). Push to
  GHCR only happens on a manual `workflow_dispatch` from `main`, never automatically and never from
  a PR.
- **`Pipeline DevSecOps.yml`** — runs on push to `main` (+ manual dispatch). Contains the **same
  four jobs** verbatim, plus `integration` (Jest against a real Postgres service container) and 5
  security gates that fan out in parallel and all gate `build`: `secrets` (Gitleaks, full git
  history), `sca` (Trivy fs — vulnerable *dependencies*), `sast` (Semgrep — vulnerable *code*),
  `iac` (Trivy config — hardened *k8s manifests*), and an image scan (Trivy) inside `build` itself,
  before the image is pushed. `build` also emits a CycloneDX SBOM per image. `e2e` (Playwright) runs
  last, after `build`.
- **`quality` (SonarQube) needs no external account or secret**: it starts a **throwaway SonarQube
  server as a container inside the job**, mints an analysis token via the API (`admin`/`admin` on a
  fresh instance), scans, and publishes the Quality Gate + key metrics into the run's Job Summary —
  the server is gone once the job ends. It's `continue-on-error: true` (measured, not yet blocking).
  This was a deliberate choice to avoid any SonarCloud account/token setup for a training repo.
- The 5 security jobs **do** block: a HIGH/CRITICAL finding fails the job (`exit-code: 1`), which
  blocks `build`, which blocks the GHCR push. They currently live as 5 matrix instances of one job
  keyed `securite` (merged so the Actions graph shows a single "Matrix: securite" card instead of 4
  separate jobs — each matrix instance runs exactly one tool via a per-step `if: matrix.id == '...'`
  condition). `demo-insecure/` and `k8s-insecure/` exist specifically to demonstrate these gates
  *failing* on purpose (run the scanners against them manually — see
  `docs/04-pipeline-devsecops.md` and `CORRECTIONS.md`) — they're excluded from the real scans.
- SCA vs. SAST vs. IaC, the three-way split worth keeping straight: SCA = what you *import*
  (dependencies), SAST = what you *write* (your own code), IaC = what you *configure*
  (infrastructure manifests).

### Kubernetes (`k8s/`)

Namespace, ConfigMap (`APP_COLOR`, `BACKEND_URL`), Secrets (DB password, JWT secret), frontend/
backend Deployments, a PostgreSQL **StatefulSet** (PVC via `volumeClaimTemplates`), a headless
Service for the DB, an Ingress, and a NetworkPolicy restricting DB access to the backend only.
Deployments pin the `:1.0.0` image tag, never `:latest`. Deployment itself is manual (`kubectl apply
-f k8s/`) — the CI pipelines only build and push images, they don't deploy.
