# Lab 00 - Preparer le cluster Killercoda

## Objectif

Verifier que le cluster peut faire les deux choses dont les labs suivants dependent :
**provisionner un volume persistant** (lab03) et **tirer les images TaskFlow** (lab04 et lab05).
Ce lab ne cree aucune ressource TaskFlow : il enleve les deux causes d'echec les plus frequentes.

## Exercice

Ouvrez le scenario **Kubernetes Playground** de Killercoda, puis repondez a ces deux questions
avec `kubectl` :

1. Le cluster possede-t-il une `StorageClass` par defaut ? Sans elle, le PVC du StatefulSet
   PostgreSQL restera `Pending` indefiniment au lab03.
2. Le cluster peut-il tirer `modovar/taskflow-backend:1.1.1` ? Le depot Docker Hub est public,
   donc la reponse doit etre oui sans aucun credential. Si le pull echoue, c'est le reseau
   sortant du cluster qu'il faut regarder, pas les droits.

## Solution

<details><summary>Afficher la solution</summary>

### 1. Acces au cluster

```bash
kubectl cluster-info
kubectl get nodes
```

Les noeuds `controlplane` et `node01` doivent etre `Ready`.

### 2. StorageClass par defaut

```bash
kubectl get storageclass
```

Si la liste est vide, ou si aucune classe ne porte la mention `(default)`, installez le
provisionneur `local-path` et faites-en la classe par defaut :

```bash
kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.31/deploy/local-path-storage.yaml
kubectl -n local-path-storage rollout status deployment/local-path-provisioner --timeout=120s
kubectl patch storageclass local-path \
  -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

Une `StorageClass` par defaut suffit : le `volumeClaimTemplates` du lab03 n'a alors pas besoin de
champ `storageClassName`, il herite de la classe par defaut.

### 3. Acces aux images TaskFlow

Les labs 04 et 05 utilisent deux depots **Docker Hub publics** :

```text
modovar/taskflow-backend:1.1.1
modovar/taskflow-frontend:1.1.1
```

Public veut dire tirable **sans aucun credential** : pas de `imagePullSecret`, pas de token, rien a
configurer. Verifiez-le depuis le cluster avant d'investir du temps dans les labs suivants :

```bash
kubectl run pull-test --image=modovar/taskflow-backend:1.1.1 \
  --restart=Never --command -- sleep 5
kubectl get pod pull-test -w   # Ctrl+C des que l'etat est stable
kubectl delete pod pull-test --ignore-not-found
```

`Running` ou `Completed` : tout va bien, passez au lab01.
`ErrImagePull` / `ImagePullBackOff` : comme le depot est public, ce n'est pas un probleme de
droits. Regardez l'acces reseau sortant du cluster vers `registry-1.docker.io`
(`kubectl describe pod pull-test` donne l'erreur exacte).

> **A retenir - registre public vs prive.** Une image hebergee dans un depot prive exige un
> `imagePullSecret` dans chaque namespace qui la consomme :
>
> ```bash
> kubectl -n taskflow create secret docker-registry regcred \
>   --docker-server=<registre> --docker-username=<user> --docker-password=<token>
> kubectl -n taskflow patch serviceaccount default \
>   -p '{"imagePullSecrets":[{"name":"regcred"}]}'
> ```
>
> Attacher le Secret au ServiceAccount `default` evite de modifier chaque manifeste. C'est le
> mecanisme a connaitre en production, ou les images sont justement privees — les labs s'en
> passent volontairement pour rester reproductibles n'importe ou.

</details>

## Test

```bash
# Une StorageClass par defaut existe
kubectl get storageclass -o jsonpath='{range .items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")]}{.metadata.name}{"\n"}{end}'

# Un volume est reellement provisionne (PVC + pod consommateur)
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

La premiere commande doit afficher le nom d'une classe (par exemple `local-path`), et le PVC de
test doit apparaitre `Bound` une fois le pod `Ready`.

> Le pod consommateur n'est pas decoratif : `local-path` utilise
> `volumeBindingMode: WaitForFirstConsumer`, donc un PVC seul reste volontairement `Pending`
> jusqu'a ce qu'un pod le monte. C'est exactement ce qui se passe au lab03, ou le pod
> `postgres-0` declenche le provisionnement.
>
> Le provisionneur `local-path` cree des volumes `hostPath` sur le noeud : parfait pour un lab,
> jamais pour de la production.
