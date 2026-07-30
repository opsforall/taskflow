# Lab 04 - Backend Deployment et Service

## Objectif

Deployer deux replicas de l'API TaskFlow et les rendre joignables par le DNS `backend`.

## Exercice

Ecrivez `backend.yaml` avec un Deployment `backend` de deux replicas et un Service `backend` sur le port `3000`. L'image est `modovar/taskflow-backend:1.1.1`. Injectez `backend-config`, `backend-secret`, puis ajoutez une readiness probe sur `/api/health/ready`.

## Solution

<details><summary>Afficher la solution</summary>

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: taskflow
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: modovar/taskflow-backend:1.1.1
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: backend-config
          env:
            - name: NODE_ENV
              value: production
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: backend-secret
                  key: DB_PASSWORD
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: backend-secret
                  key: JWT_SECRET
          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: taskflow
spec:
  selector:
    app: backend
  ports:
    - port: 3000
      targetPort: 3000
```

```bash
kubectl apply -f backend.yaml
kubectl -n taskflow rollout status deployment/backend --timeout=180s
```

Le fichier de reference se trouve dans [solution.yaml](solution.yaml) :

```bash
kubectl apply -f kubernetes/lab04/solution.yaml
```

Si les pods restent en `ImagePullBackOff`, le depot etant public il ne s'agit pas d'un probleme de
droits : voir la section *Acces aux images TaskFlow* du [lab00](../lab00/README.md).

</details>

## Test

```bash
kubectl -n taskflow get deployment backend
kubectl -n taskflow get endpoints backend
kubectl -n taskflow run api-test --image=curlimages/curl:8.10.1 --rm -i --restart=Never -- curl -fsS http://backend:3000/api/health
```

Le Deployment doit avoir `2/2` replicas disponibles et le test HTTP doit renvoyer un JSON sain.