# Étape 1 — Lancer TaskFlow à la main (sans Docker)

Avant d'automatiser quoi que ce soit, il faut comprendre ce qu'on automatise.
Ici, tu fais tourner l'application « à l'ancienne » : chaque brique installée et
lancée à la main sur ta machine. Retiens les points de friction que tu vas
rencontrer : c'est exactement ce que Docker résoudra à l'étape 2.

## Ce qu'il te faut

- **Node.js 22** (avec npm) : https://nodejs.org
- **PostgreSQL 16** : https://www.postgresql.org/download/

C'est déjà la première leçon : sans conteneurs, chaque personne doit installer
les bonnes versions elle-même. « Ça marche sur ma machine » commence ici.

## 1. Préparer la base de données

Ouvre un terminal psql (ou pgAdmin) et crée l'utilisateur et la base :

```sql
CREATE USER taskflow WITH PASSWORD 'taskflow';
CREATE DATABASE taskflow OWNER taskflow;
```

Pas besoin de créer les tables : le backend crée son schéma tout seul au
premier démarrage (fichier `backend/src/db.js`).

## 2. Lancer le backend (API)

```bash
cd backend
npm install        # installe les dépendances (express, pg, jsonwebtoken...)
npm run dev        # démarre l'API sur http://localhost:3000
```

Le backend lit sa configuration dans des **variables d'environnement**
(`DB_HOST`, `DB_PASSWORD`, `JWT_SECRET`...). Si tu ne définis rien, des valeurs
par défaut de développement s'appliquent (voir `backend/.env.example`), et elles
correspondent justement à la base créée ci-dessus.

Vérifie que ça répond :

```bash
curl http://localhost:3000/api/health          # {"status":"ok",...}
curl http://localhost:3000/api/health/ready    # {"status":"ready"} = la base répond
```

## 3. Lancer le frontend (React)

Dans un **second** terminal :

```bash
cd frontend
npm install
npm run dev        # démarre Vite sur http://localhost:5173
```

Ouvre http://localhost:5173, crée un compte, ajoute des tâches. En dev, Vite
relaie les appels `/api` vers le backend (regarde `frontend/vite.config.js`) :
le front ne connaît jamais l'adresse de la base, seulement l'API.

## 4. Lancer les tests

```bash
cd backend && npm test     # tests unitaires de l'API (base simulée)
cd frontend && npm test    # tests du thème (APP_COLOR)
```

## Ce qu'il faut retenir

- Il a fallu **2 installations système** (Node, PostgreSQL), **2 terminaux**
  ouverts en permanence, et des versions à faire correspondre.
- La configuration passe par des **variables d'environnement** : ce principe ne
  changera plus, ni avec Docker, ni avec Kubernetes.
- Toute cette mise en route manuelle, c'est ce que la conteneurisation va
  transformer en **une seule commande** : rendez-vous dans
  [02-conteneuriser.md](02-conteneuriser.md).
