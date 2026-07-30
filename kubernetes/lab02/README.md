# Lab 02 - ConfigMap et Secret

## Objectif

Sortir la configuration et les credentials du backend hors du Deployment.

## Exercice

Dans `configuration.yaml`, creez dans `taskflow` :

1. Une ConfigMap `backend-config` avec `DB_HOST=postgres`, `DB_PORT=5432`, `DB_USER=taskflow`, `DB_NAME=taskflow`, `JWT_EXPIRES_IN=24h` et `CORS_ORIGIN=*`.
2. Un Secret opaque `postgres-secret` avec `POSTGRES_PASSWORD=y2izFik82VEJOLK9j9ZWkD6m`.
3. Un Secret opaque `backend-secret` avec le **meme** `DB_PASSWORD` et un `JWT_SECRET` de 64
   caracteres hex (`openssl rand -hex 32` ; la solution en montre un).

Les deux mots de passe doivent etre identiques, sinon le backend ne s'authentifiera jamais aupres
de la base au lab04.

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
  POSTGRES_PASSWORD: y2izFik82VEJOLK9j9ZWkD6m
---
apiVersion: v1
kind: Secret
metadata:
  name: backend-secret
  namespace: taskflow
type: Opaque
stringData:
  DB_PASSWORD: y2izFik82VEJOLK9j9ZWkD6m
  JWT_SECRET: 6bdf49f6db692406cca72794847c02e166d4ead54bfd4f4b596f5cfcc8e09153
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
  --from-literal=POSTGRES_PASSWORD='y2izFik82VEJOLK9j9ZWkD6m'

kubectl -n taskflow create secret generic backend-secret \
  --from-literal=DB_PASSWORD='y2izFik82VEJOLK9j9ZWkD6m' \
  --from-literal=JWT_SECRET='6bdf49f6db692406cca72794847c02e166d4ead54bfd4f4b596f5cfcc8e09153'
```




</details>

> Un Secret n'est pas chiffre : `stringData` devient du base64 dans `data`, decodable par
> quiconque (`base64 -d`). Ces valeurs sont des placeholders. En production, jamais dans Git :
> `kubectl create secret`, SealedSecrets, Vault ou External Secrets Operator.

## Test

```bash
kubectl -n taskflow get configmap 
kubectl -n taskflow get secret 
```

