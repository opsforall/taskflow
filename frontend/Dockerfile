# ---------------------------------------------------------------
# Étape 1 : build de l'application React (artefacts statiques)
# ---------------------------------------------------------------
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------------------------------------------------------------
# Étape 2 : serveur nginx NON-ROOT (image "unprivileged", uid 101)
# — écoute sur 8080 (pas besoin de privilèges pour un port > 1024)
# ---------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.31-alpine

# ← Valeur PAR DÉFAUT de la couleur du thème, surchargeable à l'exécution :
#    docker run -e APP_COLOR=red ...        (Docker)
#    env / envFrom dans le Deployment       (Kubernetes)
#    ConfigMap frontend-config              (Kubernetes, recommandé)
ENV APP_COLOR=blue
# URL du backend pour le proxy /api. nginx exige que cet hôte résolve au
# démarrage : le défaut 127.0.0.1 permet un `docker run` isolé (démo couleur) ;
# compose et Kubernetes le surchargent avec http://backend:3000
ENV BACKEND_URL=http://127.0.0.1:3000

USER root
# Template nginx : ${BACKEND_URL} y est substitué au démarrage (envsubst intégré à l'image)
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
# Script exécuté au démarrage : génère /tmp/env.js à partir de APP_COLOR
COPY docker/40-inject-env.sh /docker-entrypoint.d/40-inject-env.sh
RUN chmod +x /docker-entrypoint.d/40-inject-env.sh
USER nginx

COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

EXPOSE 8080
