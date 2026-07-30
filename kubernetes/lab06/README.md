# Lab 06 - Service frontend et acces a l'application

## Objectif

Exposer le frontend dans le cluster et l'ouvrir dans le navigateur.

## Exercice

Ecrivez `frontend-service.yaml` qui cree un Service `frontend` dans `taskflow`, cible les pods `app: frontend`, expose le port `80` et redirige vers le port conteneur `8080`.

## Solution

<details><summary>Afficher la solution</summary>

```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: taskflow
spec:
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 8080
```

```bash
kubectl apply -f frontend-service.yaml
kubectl -n taskflow port-forward service/frontend 8080:80
```

Reference : [solution.yaml](solution.yaml)

```bash
kubectl apply -f kubernetes/lab06/solution.yaml
```

Ouvrez **Access Port 8080** dans Killercoda. Laissez le `port-forward` tourner.

</details>

## Test

Dans un second terminal Killercoda :

```bash
curl -fsS http://localhost:8080/ | grep -i taskflow
kubectl -n taskflow get endpointslices -l kubernetes.io/service-name=frontend
```

La page HTML sort, et au moins une endpoint est listee.

Le site est **bleu** (valeur posee au lab05). Gardez l'onglet et le `port-forward` ouverts pour le
[lab07](../lab07/README.md).