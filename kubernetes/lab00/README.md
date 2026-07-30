# Lab 00 - Preparer le cluster

## Environnement

> **Environnement** : [Kubernetes](https://killercoda.com/playgrounds/scenario/kubernetes)

## Objectif

Verifier les deux prerequis des labs suivants : une `StorageClass` par defaut (lab03) et l'acces a
Docker Hub (labs 04-05).

## Exercice



Le cluster a-t-il une `StorageClass` par defaut ? Sans elle, le PVC du lab03 reste `Pending`.


## Solution

<details><summary>Afficher la solution</summary>

```bash
kubectl cluster-info
kubectl get nodes
kubectl get storageclass
```

Si aucune classe n'est marquee `(default)` :

```bash
kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.31/deploy/local-path-storage.yaml
kubectl -n local-path-storage rollout status deployment/local-path-provisioner --timeout=120s
kubectl patch storageclass local-path \
  -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

</details>

