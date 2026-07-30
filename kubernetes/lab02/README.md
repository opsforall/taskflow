# Lab 02 - ConfigMap et Secret

## Objectif

Fournir au backend sa configuration non sensible et ses credentials sans les inscrire dans le Deployment.

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

Le fichier de reference se trouve dans [solution.yaml](solution.yaml) :

```bash
kubectl apply -f kubernetes/lab02/solution.yaml
```

</details>

## Test

```bash
kubectl -n taskflow get configmap backend-config
kubectl -n taskflow get secret postgres-secret backend-secret
kubectl -n taskflow get configmap backend-config -o jsonpath='{.data.DB_HOST}{"\n"}'
```

Les trois commandes doivent reussir; la derniere affiche `postgres`.