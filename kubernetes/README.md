# Atelier Kubernetes TaskFlow

Cet atelier guide le deploiement complet de TaskFlow dans un cluster Kubernetes Killercoda.
Chaque lab suit le meme format — **Objectif / Exercice / Solution / Test** — et se termine par une
verification `kubectl`. Executez-les dans l'ordre, dans un terminal Killercoda.

| Lab | Objet | Resultat |
| --- | --- | --- |
| [lab00](lab00/README.md) | Prerequis cluster | StorageClass et acces aux images verifies |
| [lab01](lab01/README.md) | Namespace | Isolation de TaskFlow |
| [lab02](lab02/README.md) | ConfigMap et Secret | Configuration et credentials |
| [lab03](lab03/README.md) | Service et StatefulSet | PostgreSQL persistant |
| [lab04](lab04/README.md) | Deployment et Service | API TaskFlow disponible dans le cluster |
| [lab05](lab05/README.md) | ConfigMap et Deployment | Frontend configure a l'execution |
| [lab06](lab06/README.md) | Service frontend | Application exposee localement |
| [lab07](lab07/README.md) | ConfigMap et rollout | Le site change de couleur, sans rebuild |
| [lab08](lab08/README.md) | Tests de bout en bout | Validation du deploiement |

Chaque lab (01 a 06) contient un `solution.yaml` applicable directement, identique au bloc YAML
de la section *Solution* de son README. Faites l'exercice d'abord : le fichier est la pour
debloquer, pas pour remplacer l'ecriture du manifeste.

Le [lab07](lab07/README.md) est l'aboutissement du fil rouge `APP_COLOR` : on y voit le site
changer de couleur en editant une ConfigMap, la meme image servant tous les themes. C'est la
demonstration visuelle de ce que la configuration au runtime apporte face a une valeur figee dans
l'image au build.

## Prerequis Killercoda

1. Ouvrez le scenario **Kubernetes Playground**.
2. Verifiez l'acces au cluster :

```bash
kubectl cluster-info
kubectl get nodes
```

3. Faites le [lab00](lab00/README.md) **avant tout le reste**. Il verifie les deux prerequis qui
   font echouer l'atelier silencieusement :

   - une `StorageClass` par defaut, sans laquelle le PVC du lab03 reste `Pending` ;
   - la connectivite vers Docker Hub, sinon les pods des labs 04 et 05 tombent en
     `ImagePullBackOff`.

Les deux images de l'atelier sont sur des depots **Docker Hub publics**, donc tirables sans
`imagePullSecret` ni token :

```text
modovar/taskflow-backend:1.1.1
modovar/taskflow-frontend:1.1.1
```

4. Recuperez les manifestes, soit en clonant le depot, soit en recopiant les solutions dans des
   fichiers `*.yaml` au fil des labs :

```bash
git clone https://github.com/opsforall/taskflow.git
cd taskflow
```

## Deployer d'un coup

Pour remonter la pile complete sans refaire les exercices (demonstration, ou reprise apres un
`kubectl delete namespace taskflow`) :

```bash
kubectl apply -f kubernetes/lab01/solution.yaml
kubectl apply -f kubernetes/lab02/solution.yaml
kubectl apply -f kubernetes/lab03/solution.yaml
kubectl apply -f kubernetes/lab04/solution.yaml
kubectl apply -f kubernetes/lab05/solution.yaml
kubectl apply -f kubernetes/lab06/solution.yaml
bash kubernetes/lab08/test.sh
```

L'ordre compte : le namespace precede tout, et ConfigMaps/Secrets precedent les workloads qui les
consomment.

## Nettoyer

```bash
kubectl delete namespace taskflow
```

Supprimer le namespace supprime aussi le PVC `data-postgres-0`, donc les donnees PostgreSQL.

## Rapport avec `k8s/`

| Repertoire | Role |
| --- | --- |
| `kubernetes/` | **Cet atelier** : manifestes minimaux, un objet a la fois, pour apprendre |
| [`k8s/`](../k8s/) | Version de **reference durcie** : securityContext, probes, resources, NetworkPolicy, Ingress |

Les solutions de cet atelier sont volontairement depouillees pour que l'objet Kubernetes etudie
reste lisible. Une fois l'atelier termine, comparez-les a `k8s/` : la difference, c'est exactement
le durcissement attendu en production (`runAsNonRoot`, `readOnlyRootFilesystem`,
`capabilities: drop [ALL]`, limites de ressources, segmentation reseau).

```bash
kubectl delete namespace taskflow
kubectl apply -f k8s/
```

> Les Secrets des labs sont pedagogiques. Ne stockez jamais de mots de passe reels dans Git en
> production.
