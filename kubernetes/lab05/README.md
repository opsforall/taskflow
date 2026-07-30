# Lab 05 - Frontend ConfigMap et Deployment

## Objectif

Configurer le theme et l'URL de l'API au demarrage du frontend, puis deployer deux replicas nginx.

## Exercice

Dans `frontend.yaml`, creez la ConfigMap `frontend-config` avec `APP_COLOR=blue` et `BACKEND_URL=http://backend:3000`, puis un Deployment `frontend` de deux replicas. Utilisez `modovar/taskflow-frontend:1.1.1`, le port conteneur `8080` et injectez la ConfigMap avec `envFrom`.

## Solution

<details><summary>Afficher la solution</summary>

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: frontend-config
  namespace: taskflow
data:
  APP_COLOR: blue
  BACKEND_URL: http://backend:3000
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: taskflow
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: modovar/taskflow-frontend:1.1.1
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: frontend-config
          readinessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 3
            periodSeconds: 5
```

```bash
kubectl apply -f frontend.yaml
```

Reference : [solution.yaml](solution.yaml)

</details>

## Test

```bash
kubectl -n taskflow get configmap frontend-config -o jsonpath='{.data.APP_COLOR}{"\n"}'
kubectl -n taskflow get deployment 
```

`blue` s'affiche, et le Deployment a `2/2` replicas disponibles.