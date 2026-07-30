# Lab 00 - Preparer le cluster

## Objectif

Verifier les deux prerequis des labs suivants : une `StorageClass` par defaut (lab03) et l'acces a
Docker Hub (labs 04-05).

## Exercice

Sur le scenario **Kubernetes Playground** de Killercoda :

1. Le cluster a-t-il une `StorageClass` par defaut ? Sans elle, le PVC du lab03 reste `Pending`.
2. Le cluster peut-il tirer `modovar/taskflow-backend:1.1.1` ?

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

Test du pull (les deux depots Docker Hub sont publics, donc aucun `imagePullSecret` n'est requis) :

```bash
kubectl run pull-test --image=modovar/taskflow-backend:1.1.1 --restart=Never --command -- sleep 5
kubectl get pod pull-test
kubectl delete pod pull-test --ignore-not-found
```

`ErrImagePull` sur un depot public = probleme de reseau sortant, pas de droits :
`kubectl describe pod pull-test`.

</details>

## Test

```bash
kubectl get storageclass -o jsonpath='{range .items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")]}{.metadata.name}{"\n"}{end}'

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: storage-check
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 128Mi
---
apiVersion: v1
kind: Pod
metadata:
  name: storage-check
spec:
  restartPolicy: Never
  containers:
    - name: writer
      image: busybox:1.36
      command: ["sh", "-c", "echo ok > /data/check && sleep 30"]
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: storage-check
EOF
kubectl wait --for=condition=Ready pod/storage-check --timeout=120s
kubectl get pvc storage-check
kubectl delete pod storage-check --now && kubectl delete pvc storage-check
```

Une classe doit etre affichee, et le PVC passer `Bound`.

> Le pod est indispensable au test : `local-path` utilise `WaitForFirstConsumer`, donc un PVC seul
> reste `Pending` jusqu'a ce qu'un pod le monte. Meme mecanique au lab03 avec `postgres-0`.
