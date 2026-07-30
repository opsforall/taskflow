# Lab 08 - Tests de deploiement

## Objectif

Valider automatiquement que toutes les briques du deploiement TaskFlow fonctionnent ensemble.

## Exercice

Avant d'executer les tests, predisez quel test echouera si le Service PostgreSQL n'est pas headless, puis lancez les commandes suivantes.

## Solution

<details><summary>Afficher la solution</summary>

Les tests ci-dessous verifient la presence des ressources, la disponibilite des workloads et les contrats de connectivite internes.

</details>

## Test

Tout est regroupe dans un script executable, [test.sh](test.sh) :

```bash
bash kubernetes/lab08/test.sh
```

Il affiche une ligne `OK` / `KO` par assertion et sort en code 1 des qu'une d'entre elles echoue.

<details><summary>Ou, lab par lab, a la main</summary>

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

Le Service PostgreSQL doit etre headless pour fournir l'identite DNS stable attendue par le StatefulSet. Les commandes se terminent sans erreur lorsque le deploiement est complet.