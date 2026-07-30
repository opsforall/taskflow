# Atelier Kubernetes TaskFlow

Deploiement complet de TaskFlow sur un cluster Killercoda, un objet a la fois.
Format de chaque lab : **Objectif / Exercice / Solution / Test**. A faire dans l'ordre.

| Lab | Objet | Resultat |
| --- | --- | --- |
| [lab00](lab00/README.md) | Prerequis cluster | StorageClass et acces aux images verifies |
| [lab01](lab01/README.md) | Namespace | Isolation de TaskFlow |
| [lab02](lab02/README.md) | ConfigMap et Secret | Configuration et credentials |
| [lab03](lab03/README.md) | Service et StatefulSet | PostgreSQL persistant |
| [lab04](lab04/README.md) | Deployment et Service | API disponible dans le cluster |
| [lab05](lab05/README.md) | ConfigMap et Deployment | Frontend configure a l'execution |
| [lab06](lab06/README.md) | Service frontend | Application exposee localement |
| [lab07](lab07/README.md) | ConfigMap et rollout | Le site change de couleur, sans rebuild |
| [lab08](lab08/README.md) | Tests de bout en bout | Validation du deploiement |

Les labs 01 a 06 ont un `solution.yaml` applicable directement, identique au bloc YAML de leur
section *Solution*. Faites l'exercice avant de l'ouvrir.

## Prerequis

Scenario **Kubernetes Playground**, puis le [lab00](lab00/README.md) avant tout le reste : il
verifie la `StorageClass` par defaut (sinon PVC `Pending` au lab03) et la connectivite Docker Hub
(sinon `ImagePullBackOff` aux labs 04-05).

Les deux images sont sur des depots Docker Hub publics, donc sans `imagePullSecret` :

```text
modovar/taskflow-backend:1.1.1
modovar/taskflow-frontend:1.1.1
```

```bash
git clone https://github.com/opsforall/taskflow.git
cd taskflow
```

## Deployer d'un coup

Pour remonter la pile sans refaire les exercices. L'ordre compte : le namespace d'abord, puis les
ConfigMaps/Secrets avant les workloads qui les consomment.

```bash
kubectl apply -f kubernetes/lab01/solution.yaml
kubectl apply -f kubernetes/lab02/solution.yaml
kubectl apply -f kubernetes/lab03/solution.yaml
kubectl apply -f kubernetes/lab04/solution.yaml
kubectl apply -f kubernetes/lab05/solution.yaml
kubectl apply -f kubernetes/lab06/solution.yaml
bash kubernetes/lab08/test.sh
```

## Nettoyer

```bash
kubectl delete namespace taskflow
```

Supprime aussi le PVC `data-postgres-0`, donc les donnees PostgreSQL.

## Rapport avec `k8s/`

| Repertoire | Role |
| --- | --- |
| `kubernetes/` | Cet atelier : manifestes minimaux, pour apprendre |
| [`k8s/`](../k8s/) | Version durcie : securityContext, probes, resources, NetworkPolicy, Ingress |

Les solutions sont volontairement depouillees pour que l'objet etudie reste lisible. Une fois
l'atelier fini, comparez avec `k8s/` : la difference est exactement le durcissement attendu en
production.

```bash
kubectl delete namespace taskflow
kubectl apply -f k8s/
```

> Les Secrets des labs sont pedagogiques. Jamais de vrais mots de passe dans Git.
