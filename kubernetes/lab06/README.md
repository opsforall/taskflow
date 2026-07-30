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
kubectl -n taskflow port-forward --address 0.0.0.0 service/frontend 8080:80
```

Reference : [solution.yaml](solution.yaml)

Ouvrez **Access Port 8080** dans Killercoda. Laissez le `port-forward` tourner.

`--address 0.0.0.0` est indispensable : par defaut kubectl n'ecoute que sur `127.0.0.1`, donc le
proxy de Killercoda, qui vient de l'exterieur, ne trouve personne et renvoie **502 Bad Gateway**.
Un `curl localhost:8080` depuis le terminal marcherait pourtant, puisqu'il part du meme host.

**Sur un cluster local** (Docker Desktop, minikube, kind), le navigateur est sur la meme machine :

```bash
kubectl -n taskflow port-forward service/frontend 8080:80
```

Puis http://localhost:8080

### Se connecter a l'application

Aucun compte n'existe au depart : commencez par **Inscription**.

| Champ | Contrainte | Exemple |
| --- | --- | --- |
| Nom | 2 caracteres minimum | `Demo` |
| Email | format email valide | `demo@taskflow.local` |
| Mot de passe | **8 caracteres minimum** | `taskflow123` |

L'inscription connecte directement (elle renvoie un JWT, stocke dans le `localStorage` du
navigateur). Les comptes vivent dans PostgreSQL : ils survivent a un redemarrage des pods, mais
disparaissent avec le PVC si vous supprimez le namespace.

</details>

## Test

Dans un second terminal Killercoda :

```bash
curl -fsS http://localhost:8080/ | grep -i taskflow
kubectl -n taskflow get endpointslices -l kubernetes.io/service-name=frontend
```


Le site est **bleu** (valeur posee au lab05). 