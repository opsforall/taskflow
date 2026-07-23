# ==============================================================================
# Dockerfile FRONTEND (React/Vite) — build multi-stage
# ==============================================================================
# Cas d'école du multi-stage : on a besoin de Node UNIQUEMENT pour compiler le
# React en fichiers statiques (HTML/CSS/JS). Une fois compilés, ces fichiers sont
# servis par un simple serveur web (nginx). L'image finale ne contient donc ni
# Node, ni le code source, ni les dépendances npm — juste nginx + les assets.
# ------------------------------------------------------------------------------

# --- Étape 1 : « build » — compilation des assets statiques -------------------
FROM node:22-alpine AS build
WORKDIR /app

# Dépendances d'abord (layer caching, cf. Dockerfile backend). Ici on garde les
# devDependencies : Vite, le compilateur, sont nécessaires POUR builder.
COPY package.json package-lock.json ./
RUN npm ci

# Puis le code source, et on génère le dossier /app/dist (HTML/CSS/JS minifiés).
COPY . .
RUN npm run build

# --- Étape 2 : serveur web nginx, NON-ROOT -----------------------------------
# On part d'une image nginx « unprivileged » : elle tourne sous l'utilisateur
# nginx (uid 101) et écoute sur le port 8080. Un port > 1024 ne nécessite pas de
# privilèges root — c'est ce qui permet un conteneur entièrement non-root.
FROM nginxinc/nginx-unprivileged:1.31-alpine

# ─── Variable de démo : couleur du thème ───────────────────────────────────
# Point pédagogique clé (12-factor app) : on construit l'image UNE fois, et on la
# configure au DÉMARRAGE via des variables d'environnement — sans rebuild.
# Ici APP_COLOR a une valeur par défaut, surchargeable à l'exécution à 3 niveaux :
#    docker run -e APP_COLOR=red ...     (Docker)
#    env / envFrom dans le Deployment    (Kubernetes)
#    ConfigMap frontend-config           (Kubernetes, recommandé)
ENV APP_COLOR=blue

# URL du backend pour le proxy /api. nginx exige que cet hôte RÉSOLVE au démarrage :
# le défaut 127.0.0.1 permet un `docker run` isolé (démo couleur seule) ; compose
# et Kubernetes le surchargent par http://backend:3000 (nom de service DNS interne).
ENV BACKEND_URL=http://127.0.0.1:3000

# On passe temporairement root le temps de déposer la config, puis on redevient
# non-root. Les fichiers ci-dessous s'appuient sur des mécanismes de l'image nginx :
USER root

# 1) Template nginx : le placeholder ${BACKEND_URL} y sera remplacé au démarrage
#    par la valeur de la variable d'environnement (envsubst, intégré à l'image
#    officielle nginx, qui traite tout /etc/nginx/templates/*.template).
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# 2) Script d'entrypoint exécuté au démarrage du conteneur : il génère /tmp/env.js
#    à partir de APP_COLOR. C'est ce qui « injecte » la couleur dans le front
#    statique au runtime (le React lit ce fichier avant de s'afficher).
#    Tout script placé dans /docker-entrypoint.d/ est lancé automatiquement.
COPY docker/40-inject-env.sh /docker-entrypoint.d/40-inject-env.sh
RUN chmod +x /docker-entrypoint.d/40-inject-env.sh

USER nginx

# On copie les assets compilés depuis l'étape « build » vers le dossier servi par
# nginx. --chown évite des soucis de permissions puisqu'on tourne en non-root.
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Documentaire : nginx-unprivileged écoute sur 8080 (voir default.conf.template).
EXPOSE 8080
