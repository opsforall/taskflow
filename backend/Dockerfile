# ==============================================================================
# Dockerfile BACKEND (API Node.js/Express) — build multi-stage
# ==============================================================================
# Un build « multi-stage » utilise plusieurs images (FROM) dans un même
# Dockerfile. On construit dans une première étape, puis on ne copie QUE le
# résultat utile dans l'image finale. Avantage : l'image livrée ne contient ni
# outils de build ni fichiers superflus → plus petite, plus rapide à déployer,
# et surtout moins de surface d'attaque.
# ------------------------------------------------------------------------------

# --- Étape 1 : « deps » — installation des dépendances de production ----------
FROM node:22-alpine AS deps
WORKDIR /app

# On copie d'ABORD package.json + package-lock.json (avant le code source).
# Pourquoi ? Docker met en cache chaque instruction (« layer »). Tant que ces
# deux fichiers ne changent pas, l'étape `npm ci` ci-dessous est réutilisée
# depuis le cache — on ne réinstalle pas les dépendances à chaque changement de
# code. C'est le principe du « layer caching ».
COPY package.json package-lock.json ./

# `npm ci` (clean install) installe EXACTEMENT les versions du package-lock.json
# (reproductible), contrairement à `npm install` qui peut faire évoluer le lock.
# `--omit=dev` : on n'installe pas les dépendances de développement (jest,
# eslint…), inutiles en production et qui alourdissent/exposent l'image.
RUN npm ci --omit=dev

# --- Étape 2 : image finale minimale exécutée en production -------------------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# Durcissement (hardening) : à l'exécution, seul le binaire `node` est utile.
# On retire npm, npx, corepack et yarn de l'image finale. Cela réduit la surface
# d'attaque ET élimine les vulnérabilités portées par LEURS propres dépendances
# embarquées (tar, brace-expansion…), que le scanner Trivy signalerait dans la
# pipeline — alors que l'application, elle, n'en a pas besoin pour tourner.
RUN rm -rf /usr/local/lib/node_modules \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg

# On récupère les dépendances déjà installées dans l'étape « deps », puis le code.
# Les node_modules changent rarement → placés avant le code pour profiter du cache.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Principe de moindre privilège : ne JAMAIS exécuter le conteneur en root.
# Si un attaquant compromet le process, il n'aura pas les droits root du conteneur.
# L'utilisateur « node » (uid 1000) est déjà fourni par l'image officielle.
USER node

# EXPOSE est purement DOCUMENTAIRE : il indique le port que l'app écoute.
# Il ne publie rien ; la publication se fait avec `-p` (docker) ou dans compose/k8s.
EXPOSE 3000

# HEALTHCHECK : Docker interroge périodiquement cet endpoint pour connaître l'état
# de santé du conteneur (healthy / unhealthy). Utile pour l'orchestration et le
# redémarrage automatique. En Kubernetes, ce rôle est tenu par les probes.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Forme « exec » (tableau JSON) recommandée : le process node devient PID 1 et
# reçoit correctement les signaux (SIGTERM) pour un arrêt propre.
CMD ["node", "src/index.js"]
