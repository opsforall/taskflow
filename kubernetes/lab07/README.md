# Lab 07 - Changer la couleur du site via la ConfigMap

## Objectif

Voir le site changer de couleur en editant une ConfigMap, sans rebuild ni repush de l'image.

Gardez le `port-forward` du lab06 et le navigateur ouverts.

## Comment ca marche

| Etage | Role |
| --- | --- |
| ConfigMap `frontend-config` | contient `APP_COLOR: blue` |
| `envFrom` du Deployment | expose la cle comme variable d'environnement dans le conteneur |
| `40-inject-env.sh` (entrypoint) | **au demarrage du conteneur**, ecrit `/tmp/config.js` : `window.__ENV__ = { APP_COLOR: "blue" };` |
| `frontend/src/theme.js` | lit `window.__ENV__.APP_COLOR` et applique les variables CSS |

Le script tourne au demarrage du conteneur, pas a chaque requete : editer la ConfigMap ne suffit
pas, il faut recreer les pods.

Couleurs reconnues : `blue`, `red`, `yellow`, `green`, `purple`, `teal`.

## Exercice

1. Passez la ConfigMap en `red`. La page ne change pas — pourquoi ?
2. Faites prendre effet au changement.
3. Passez en `purple` sans toucher a la ConfigMap, en une commande.
4. Mettez `APP_COLOR: orange` et predisez le resultat.
5. Revenez a `blue`.

## Solution

<details><summary>Afficher la solution</summary>

### 1. Editer la ConfigMap

```bash
kubectl -n taskflow patch configmap frontend-config --type merge -p '{"data":{"APP_COLOR":"red"}}'
kubectl -n taskflow exec deploy/frontend -- cat /tmp/config.js   # toujours "blue"
```

Les variables d'environnement sont figees a la creation du conteneur : les pods en cours ont ecrit
leur `config.js` quand la valeur etait `blue`, et ne le regenereront jamais.

> Une ConfigMap montee en **volume** serait, elle, mise a jour dans le pod (delai ~1 min). Ici c'est
> `envFrom`, donc des variables d'environnement : jamais.

### 2. Recreer les pods

```bash
kubectl -n taskflow rollout restart deployment/frontend
kubectl -n taskflow rollout status deployment/frontend --timeout=120s
kubectl -n taskflow exec deploy/frontend -- cat /tmp/config.js   # maintenant "red"
```

Rechargez avec `Ctrl+Shift+R`. Le site est rouge, l'image n'a pas change.

Le `rollout restart` remplace les pods un par un, le site reste servi. Si le `port-forward` se
coupe, c'est qu'il visait un pod detruit : relancez-le.

### 3. Surcharger sans la ConfigMap

```bash
kubectl -n taskflow set env deployment/frontend APP_COLOR=purple   # redemarre tout seul
```

Ce `env` en dur est prioritaire sur `envFrom` : la ConfigMap ne pilote plus rien jusqu'a

```bash
kubectl -n taskflow set env deployment/frontend APP_COLOR-   # le tiret final supprime la variable
```

Pratique pour un test, mais c'est l'anti-pattern que la ConfigMap evite.

### 4. Couleur inconnue

```bash
kubectl -n taskflow patch configmap frontend-config --type merge -p '{"data":{"APP_COLOR":"orange"}}'
kubectl -n taskflow rollout restart deployment/frontend
kubectl -n taskflow rollout status deployment/frontend --timeout=120s
```

`/config.js` contient `"orange"`, mais le site reste bleu : `resolveTheme()` ne connait pas la
couleur et retombe sur `DEFAULT_THEME`. Aucune erreur, aucun log — panne muette.

### 5. Revenir a l'etat initial

```bash
kubectl -n taskflow patch configmap frontend-config --type merge -p '{"data":{"APP_COLOR":"blue"}}'
kubectl -n taskflow rollout restart deployment/frontend
kubectl -n taskflow rollout status deployment/frontend --timeout=120s
```

</details>

## Test

Verifie la chaine ConfigMap → variable d'environnement → `/config.js`, et remet `blue`.

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

kubectl -n taskflow get deploy frontend -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
```

Trois lignes `OK`, et l'image affichee reste `modovar/taskflow-frontend:1.1.1` : une seule image,
six themes.
