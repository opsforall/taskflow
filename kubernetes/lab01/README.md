# Lab 01 - Namespace

## Objectif

Creer le namespace qui isole les ressources TaskFlow.

## Exercice

Ecrivez `namespace.yaml` : un namespace `taskflow` portant le label `app.kubernetes.io/name: taskflow`.

## Solution

<details><summary>Afficher la solution</summary>

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: taskflow
  labels:
    app.kubernetes.io/name: taskflow
```

```bash
kubectl apply -f namespace.yaml
```

Reference : [solution.yaml](solution.yaml)

```bash
kubectl apply -f kubernetes/lab01/solution.yaml
```

</details>

## Test

```bash
kubectl get namespace 
```

Doit afficher `taskflow`.