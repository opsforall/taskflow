# Étape 2 — Conteneuriser TaskFlow (Docker et Compose)

À l'étape 1, tu as installé Node et PostgreSQL à la main. Ici, tout ça part
dans des **conteneurs** : chaque brique embarque son environnement, et la stack
complète démarre en une commande. Seul prérequis : **Docker Desktop**.

## 1. Comprendre les deux Dockerfiles (5 min de lecture)

Avant de builder, ouvre-les, ils sont très commentés :

- [`backend/Dockerfile`](../backend/Dockerfile) : build **multi-stage** (les
  dépendances s'installent dans une première image, seule la partie utile est
  copiée dans l'image finale), utilisateur **non-root**, healthcheck.
- [`frontend/Dockerfile`](../frontend/Dockerfile) : cas d'école : Node sert
  uniquement à **compiler** le React, puis un simple **nginx** sert les fichiers
  statiques. L'image finale ne contient même plus Node.

## 2. Builder et lancer une image à la main

```bash
docker build -t taskflow-frontend ./frontend
docker run --rm -e APP_COLOR=red -p 8080:8080 taskflow-frontend
```

Ouvre http://localhost:8080 : le thème est **rouge**. Relance avec
`-e APP_COLOR=purple` : violet, **sans rebuilder**. C'est le point clé du
projet : l'image est construite une fois, la configuration est injectée au
démarrage du conteneur (regarde `frontend/docker/40-inject-env.sh`).

(L'API ne répond pas encore : le front est seul. C'est le problème suivant.)

## 3. Lancer la stack complète avec Compose

Trois conteneurs qui doivent se parler (front, API, base) : c'est le travail de
**Docker Compose**, décrit dans [`docker-compose.yml`](../docker-compose.yml)
(commenté lui aussi).

```bash
cp .env.example .env      # secrets de dev (jamais commités)
docker compose up --build
```

- Front : http://localhost:8080 (crée un compte, ajoute des tâches)
- API : http://localhost:3000/api/health

Ce que Compose t'apporte au passage :

- un **réseau privé** avec DNS : le backend joint la base via `db`, pas une IP ;
- l'**ordre de démarrage** : le backend attend que la base soit *healthy* ;
- un **volume** : les données survivent à l'arrêt des conteneurs ;
- la base n'est **pas exposée** sur ta machine, seuls 8080 et 3000 le sont.

## 4. La démo couleur, version Compose

```bash
docker compose down
APP_COLOR=yellow docker compose up --build           # bash
$env:APP_COLOR="yellow"; docker compose up --build   # PowerShell
```

Même image, couleur différente. À l'étape Kubernetes, cette même variable
viendra d'une **ConfigMap**, et rien d'autre ne changera.

## Ce qu'il faut retenir

- Plus aucune installation de Node ni PostgreSQL : Docker suffit.
- **Build une fois, configurer au démarrage** : la variable d'environnement est
  le contrat entre l'image et son environnement.
- Compose orchestre en local ce que Kubernetes orchestrera en production.
- Prochaine étape : automatiser tests et sécurité à chaque changement de code,
  dans [03-pipeline-ci.md](03-pipeline-ci.md).
