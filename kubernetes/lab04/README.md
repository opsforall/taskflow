# Lab 04 - Backend Deployment et Service

## Objectif

Deployer deux replicas de l'API, joignables via le DNS `backend`.

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

Reference : [solution.yaml](solution.yaml)

```bash
kubectl apply -f kubernetes/lab04/solution.yaml
```

Pods en `ImagePullBackOff` : le depot etant public, voir [lab00](../lab00/README.md).

</details>

## Test

```bash
kubectl -n taskflow get deployment backend
kubectl -n taskflow get endpointslices -l kubernetes.io/service-name=backend
kubectl -n taskflow run api-test --image=curlimages/curl:8.10.1 --rm -i --restart=Never -- curl -fsS http://backend:3000/api/health
```

`2/2` replicas disponibles, et le test HTTP renvoie un JSON sain.