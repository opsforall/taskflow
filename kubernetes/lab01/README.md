# Lab 01 - Namespace

## Objectif

Creer le namespace qui isolera toutes les ressources TaskFlow.

## Exercice

Ecrivez `namespace.yaml` qui cree un namespace nomme `taskflow` et lui ajoute le label `app.kubernetes.io/name: taskflow`.

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

Le fichier de reference se trouve dans [solution.yaml](solution.yaml) :

```bash
kubectl apply -f kubernetes/lab01/solution.yaml
```

</details>

## Test

```bash
kubectl get namespace taskflow -o jsonpath='{.metadata.labels.app\.kubernetes\.io/name}{"\n"}'
```

Le resultat attendu est `taskflow`.