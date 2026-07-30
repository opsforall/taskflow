# Lab 08 - Tests de deploiement

## Objectif

Valider que toutes les briques fonctionnent ensemble.

## Exercice

Predisez quel test echoue si le Service PostgreSQL n'est pas headless, puis lancez les tests.

## Solution

<details><summary>Afficher la solution</summary>

Le Service PostgreSQL doit avoir `clusterIP: None` pour donner au StatefulSet l'identite DNS stable
qu'il attend. Sinon `pg_isready` sur `postgres-0` et la readiness du backend (`/api/health/ready`,
qui interroge la base) tombent.

</details>

## Test

```bash
bash kubernetes/lab08/test.sh
```

Une ligne `OK` / `KO` par assertion, code de sortie 1 au premier echec.

<details><summary>Ou a la main</summary>

```bash
# Ressources attendues
kubectl -n taskflow get configmap backend-config frontend-config
kubectl -n taskflow get secret postgres-secret backend-secret
kubectl -n taskflow get statefulset postgres
kubectl -n taskflow get deployment backend frontend
kubectl -n taskflow get service postgres backend frontend

# Etat des workloads
kubectl -n taskflow rollout status statefulset/postgres --timeout=180s
kubectl -n taskflow rollout status deployment/backend --timeout=180s
kubectl -n taskflow rollout status deployment/frontend --timeout=180s

# Base et API a travers les Services internes
kubectl -n taskflow exec postgres-0 -- pg_isready -U taskflow -d taskflow
kubectl -n taskflow run api-smoke --image=curlimages/curl:8.10.1 --rm -i --restart=Never -- curl -fsS http://backend:3000/api/health/ready

# Contrats Kubernetes importants
test "$(kubectl -n taskflow get svc postgres -o jsonpath='{.spec.clusterIP}')" = "None"
test "$(kubectl -n taskflow get deploy backend -o jsonpath='{.status.availableReplicas}')" = "2"
test "$(kubectl -n taskflow get deploy frontend -o jsonpath='{.status.availableReplicas}')" = "2"
echo "Tous les tests TaskFlow sont passes."
```

</details>
