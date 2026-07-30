# Lab 02 - ConfigMap et Secret

## Objectif

Sortir la configuration et les credentials du backend hors du Deployment.

## Exercice

Dans `configuration.yaml`, creez dans `taskflow` :

1. Une ConfigMap `backend-config` avec `DB_HOST=postgres`, `DB_PORT=5432`, `DB_USER=taskflow`, `DB_NAME=taskflow`, `JWT_EXPIRES_IN=24h` et `CORS_ORIGIN=*`.
2. Un Secret opaque `postgres-secret` avec `POSTGRES_PASSWORD`.
3. Un Secret opaque `backend-secret` avec le meme `DB_PASSWORD` et un `JWT_SECRET`.

## Solution

<details><summary>Afficher la solution</summary>

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
  namespace: taskflow
data:
  DB_HOST: postgres
  DB_PORT: "5432"
  DB_USER: taskflow
  DB_NAME: taskflow
  JWT_EXPIRES_IN: 24h
  CORS_ORIGIN: "*"
---
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
  namespace: taskflow
type: Opaque
stringData:
  POSTGRES_PASSWORD: change-me-in-prod
---
apiVersion: v1
kind: Secret
metadata:
  name: backend-secret
  namespace: taskflow
type: Opaque
stringData:
  DB_PASSWORD: change-me-in-prod
  JWT_SECRET: change-me-generate-a-random-64-char-string
```

```bash
kubectl apply -f configuration.yaml
```

Reference : [solution.yaml](solution.yaml)

```bash
kubectl apply -f kubernetes/lab02/solution.yaml
```

### Methode imperative

Meme resultat, sans ecrire de YAML :

```bash
kubectl -n taskflow create configmap backend-config \
  --from-literal=DB_HOST=postgres \
  --from-literal=DB_PORT=5432 \
  --from-literal=DB_USER=taskflow \
  --from-literal=DB_NAME=taskflow \
  --from-literal=JWT_EXPIRES_IN=24h \
  --from-literal=CORS_ORIGIN='*'

kubectl -n taskflow create secret generic postgres-secret \
  --from-literal=POSTGRES_PASSWORD='change-me-in-prod'

kubectl -n taskflow create secret generic backend-secret \
  --from-literal=DB_PASSWORD='change-me-in-prod' \
  --from-literal=JWT_SECRET='change-me-generate-a-random-64-char-string'
```

Quotez `'*'`, sinon le shell l'etend en liste de fichiers.

`create` echoue si l'objet existe deja (contrairement a `apply`). Pour rejouer :

```bash
kubectl -n taskflow delete configmap backend-config
```

Pour generer le YAML a partir de la commande, au lieu de creer l'objet :

```bash
kubectl -n taskflow create configmap backend-config --from-literal=DB_HOST=postgres \
  --dry-run=client -o yaml
```

C'est le pont entre les deux approches : imperatif pour aller vite, `--dry-run=client -o yaml`
pour obtenir un manifeste versionnable dans Git.

</details>

## Test

```bash
kubectl -n taskflow get configmap backend-config
kubectl -n taskflow get secret postgres-secret backend-secret
kubectl -n taskflow get configmap backend-config -o jsonpath='{.data.DB_HOST}{"\n"}'
```

Les trois commandes reussissent, la derniere affiche `postgres`.