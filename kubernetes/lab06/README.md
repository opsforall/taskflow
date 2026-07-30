# Lab 06 - Service frontend et acces a l'application

## Objectif

Exposer le frontend a l'interieur du cluster, puis l'ouvrir depuis le navigateur Killercoda.

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

Le fichier de reference se trouve dans [solution.yaml](solution.yaml) :

```bash
kubectl apply -f kubernetes/lab06/solution.yaml
```

Ouvrez le bouton **Access Port 8080** de Killercoda. Gardez le `port-forward` actif dans son terminal.

</details>

## Test

Dans un second terminal Killercoda :

```bash
curl -fsS http://localhost:8080/ | grep -i taskflow
kubectl -n taskflow get endpoints frontend
```

La page HTML et au moins une endpoint frontend doivent etre presentes.

Le site s'affiche en **bleu**, la valeur posee dans la ConfigMap au lab05. Gardez cet onglet et le
`port-forward` ouverts : le [lab07](../lab07/README.md) va changer cette couleur sans reconstruire
l'image.