# Étape 1 : installation des dépendances de production uniquement
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Étape 2 : image finale minimale
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# À l'exécution, seul le binaire `node` est nécessaire : on retire npm, corepack
# et yarn de l'image finale. Cela réduit la surface d'attaque et élimine les
# vulnérabilités de LEURS dépendances embarquées (tar, brace-expansion…) que
# Trivy détecterait — l'application, elle, n'en dépend pas.
RUN rm -rf /usr/local/lib/node_modules \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Bonne pratique sécurité : ne jamais tourner en root dans le conteneur
# (l'utilisateur "node" existe déjà dans l'image officielle, uid 1000)
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "src/index.js"]
