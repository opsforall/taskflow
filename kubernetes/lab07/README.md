# Lab 07 - Changer la couleur du site via la ConfigMap

## Objectif

Voir le site **changer de couleur** en modifiant une variable d'environnement dans la ConfigMap,
**sans reconstruire ni repousser l'image**. C'est la demonstration concrete du principe 12-factor
« une image, plusieurs configurations » : la meme image `modovar/taskflow-frontend:1.1.1` sert le
site en bleu, en rouge ou en violet selon ce que le cluster lui injecte au demarrage.

Gardez le `port-forward` du lab06 actif et le navigateur ouvert : vous allez voir la couleur changer
sous vos yeux.

## Comment ca marche

Trois etages, a comprendre avant de manipuler :

| Etage | Ce qui se passe |
| --- | --- |
| ConfigMap `frontend-config` | contient `APP_COLOR: blue` |
| `envFrom` du Deployment | transforme la cle en variable d'environnement `APP_COLOR` dans le conteneur |
| `40-inject-env.sh` (entrypoint nginx) | au **demarrage du conteneur**, ecrit `/tmp/config.js` : `window.__ENV__ = { APP_COLOR: "blue" };` |

Puis, dans le navigateur, `frontend/src/theme.js` lit `window.__ENV__.APP_COLOR` avant le premier
rendu et applique les variables CSS correspondantes.

Le point cle est en gras : le script tourne **au demarrage du conteneur**, pas a chaque requete.
Modifier la ConfigMap ne suffit donc pas — il faut recreer les pods. C'est tout l'objet de
l'exercice 2.

Couleurs reconnues : `blue`, `red`, `yellow`, `green`, `purple`, `teal`.

## Exercice

1. Passez le site en **rouge** en modifiant la ConfigMap `frontend-config`, puis constatez que la
   page ne change pas encore. Pourquoi ?
2. Faites prendre effet au changement, puis rechargez le navigateur.
3. Passez en **purple** sans toucher a la ConfigMap, avec une seule commande.
4. Mettez `APP_COLOR: orange` et predisez le resultat avant de regarder.
5. Revenez a `blue`.

## Solution

<details><summary>Afficher la solution</summary>

### 1. Modifier la ConfigMap

Au choix, en interactif ou en une ligne :

```bash
kubectl -n taskflow edit configmap frontend-config       # APP_COLOR: red
# ou, sans editeur :
kubectl -n taskflow patch configmap frontend-config \
  --type merge -p '{"data":{"APP_COLOR":"red"}}'
```

La ConfigMap contient bien `red` :

```bash
kubectl -n taskflow get configmap frontend-config -o jsonpath='{.data.APP_COLOR}{"\n"}'
```

...mais la page est toujours bleue, et `/config.js` aussi :

```bash
kubectl -n taskflow exec deploy/frontend -- cat /tmp/config.js
```

**Pourquoi** : les variables d'environnement d'un conteneur sont figees a sa creation. Les pods qui
tournent ont ete demarres quand la ConfigMap valait `blue` ; leur `/tmp/config.js` a ete ecrit a ce
moment-la et ne sera plus jamais regenere.

> A savoir : une ConfigMap montee en **volume** est, elle, mise a jour dans le pod (avec un delai
> de l'ordre de la minute). Ce n'est pas le cas ici — nous utilisons `envFrom`, donc des variables
> d'environnement, et celles-la ne bougent jamais.

### 2. Recreer les pods

```bash
kubectl -n taskflow rollout restart deployment/frontend
kubectl -n taskflow rollout status deployment/frontend --timeout=120s
kubectl -n taskflow exec deploy/frontend -- cat /tmp/config.js
```

`/config.js` annonce maintenant `red`. Rechargez le navigateur (`Ctrl+Shift+R` pour contourner le
cache) : boutons, liens et accents passent au rouge. **L'image n'a pas ete rebuildee** — le digest
est identique, seule la configuration injectee a change.

Le `rollout restart` remplace les pods un par un (`RollingUpdate`), donc le site reste servi pendant
la bascule. Si le `port-forward` du lab06 se coupe, c'est parce qu'il etait attache a un pod
detruit : relancez-le, il visait le Service.

### 3. Surcharger sans passer par la ConfigMap

```bash
kubectl -n taskflow set env deployment/frontend APP_COLOR=purple
```

Cette commande ecrit un bloc `env` directement dans le Deployment **et** declenche le redemarrage
toute seule. Attention : cette valeur en dur est prioritaire sur `envFrom`, donc la ConfigMap ne
pilote plus rien tant que vous ne l'avez pas retiree :

```bash
kubectl -n taskflow set env deployment/frontend APP_COLOR-   # note le tiret final
```

C'est pratique pour un test rapide, mais c'est exactement l'anti-pattern que la ConfigMap est censee
eviter : la configuration retourne vivre dans le manifeste du workload.

### 4. Une couleur inconnue

```bash
kubectl -n taskflow patch configmap frontend-config \
  --type merge -p '{"data":{"APP_COLOR":"orange"}}'
kubectl -n taskflow rollout restart deployment/frontend
kubectl -n taskflow rollout status deployment/frontend --timeout=120s
```

`/config.js` contient bien `"orange"` — l'injection fait son travail sans juger la valeur. Mais le
site reste **bleu** : `resolveTheme()` dans `frontend/src/theme.js` ne connait pas `orange` et
retombe sur `DEFAULT_THEME`. Aucune erreur, aucun log : une faute de frappe dans une ConfigMap
donne un site qui a l'air normal. C'est le genre de panne muette a garder en tete.

### 5. Revenir a l'etat initial

```bash
kubectl -n taskflow patch configmap frontend-config \
  --type merge -p '{"data":{"APP_COLOR":"blue"}}'
kubectl -n taskflow rollout restart deployment/frontend
kubectl -n taskflow rollout status deployment/frontend --timeout=120s
```

</details>

## Test

Ce test verifie la chaine complete : ConfigMap → variable d'environnement → `/config.js` servi par
nginx. Il boucle sur trois couleurs, en repartant de `blue` a la fin.

```bash
for COLOR in red teal blue; do
  kubectl -n taskflow patch configmap frontend-config \
    --type merge -p "{\"data\":{\"APP_COLOR\":\"$COLOR\"}}"
  kubectl -n taskflow rollout restart deployment/frontend
  kubectl -n taskflow rollout status deployment/frontend --timeout=120s

  SERVED=$(kubectl -n taskflow run color-check-$COLOR \
    --image=curlimages/curl:8.10.1 --rm -i --restart=Never --quiet \
    -- curl -fsS http://frontend/config.js)
  echo "$SERVED" | grep -q "\"$COLOR\"" \
    && echo "OK   /config.js sert APP_COLOR=$COLOR" \
    || { echo "KO   attendu $COLOR, obtenu : $SERVED"; exit 1; }
done
echo "La couleur est bien pilotee par la ConfigMap, sans rebuild d'image."
```

Chaque iteration doit afficher une ligne `OK`. Dans le navigateur, la page change de couleur apres
chaque `rollout restart` suivi d'un rechargement force.

> Verifiez au passage que l'image n'a pas bouge :
>
> ```bash
> kubectl -n taskflow get deploy frontend -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
> ```
>
> Toujours `modovar/taskflow-frontend:1.1.1`. Une seule image, six themes possibles : c'est
> precisement ce que permet l'injection au runtime, et ce que le lab08 verifiera une derniere fois.
