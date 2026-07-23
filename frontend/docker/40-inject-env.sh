#!/bin/sh
# Injection de la configuration runtime dans le front statique.
#
# Génère /tmp/env.js à partir des variables d'environnement du conteneur ;
# nginx le sert sur /env.js (voir default.conf.template). Écrire dans /tmp
# (et pas dans /usr/share/nginx/html) permet de garder le système de
# fichiers racine en lecture seule (readOnlyRootFilesystem en Kubernetes).
set -eu

APP_COLOR="${APP_COLOR:-blue}"

cat > /tmp/env.js <<EOF
window.__ENV__ = { APP_COLOR: "${APP_COLOR}" };
EOF

echo "40-inject-env.sh : APP_COLOR=${APP_COLOR} injecté dans /env.js"
