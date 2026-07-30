# Lab 03 - PostgreSQL StatefulSet et Service

## Objectif

Deployer une base PostgreSQL persistante avec une identite reseau stable.

## Exercice

Ecrivez `postgres.yaml` avec :

1. Le Service headless `postgres` sur le port `5432`.
2. Un StatefulSet `postgres` a une replique, utilisant `postgres:16.4-alpine`.
3. Les variables `POSTGRES_USER=taskflow`, `POSTGRES_DB=taskflow`, `PGDATA=/var/lib/postgresql/data/pgdata` et le mot de passe depuis `postgres-secret`.
4. Un `volumeClaimTemplates` de `1Gi`, `ReadWriteOnce`.
5. Une readiness probe `exec` sur `pg_isready`.

## Solution

<details><summary>Afficher la solution</summary>

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: taskflow
spec:
  clusterIP: None
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: taskflow
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16.4-alpine
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_USER
              value: taskflow
            - name: POSTGRES_DB
              value: taskflow
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: POSTGRES_PASSWORD
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "taskflow", "-d", "taskflow"]
            initialDelaySeconds: 5
            periodSeconds: 5
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 1Gi
```

```bash
kubectl apply -f postgres.yaml
kubectl -n taskflow rollout status statefulset/postgres --timeout=180s
```

Reference : [solution.yaml](solution.yaml)

```bash
kubectl apply -f kubernetes/lab03/solution.yaml
```

</details>

## Test

```bash
kubectl -n taskflow get pod postgres-0
kubectl -n taskflow get pvc data-postgres-0
kubectl -n taskflow exec postgres-0 -- pg_isready -U taskflow -d taskflow
```

Pod `Running`, PVC `Bound`, `pg_isready` accepte les connexions.