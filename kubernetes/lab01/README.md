# Lab 01 - Namespace

## Objectif

Creer le namespace qui isole les ressources TaskFlow.

## Exercice

Ecrivez `namespace.yaml` : un namespace `taskflow` portant le label `app.kubernetes.io/name: taskflow`.

## Solution

<details><summary>Afficher la solution</summary>

```bash
vi namespace.yaml 
```

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

Reference : [namespace.yaml](namespace.yaml)



</details>

## Test

```bash
kubectl get namespace 
```

Doit afficher `taskflow`.