# Étape 3 — La pipeline DevOps, pas à pas

Aux étapes 1 et 2, tu vérifiais tout à la main : lancer les tests, relire ton
code, builder l'image. Cette page ouvre
[`Pipeline DevOps.yml`](../.github/workflows/Pipeline%20DevOps.yml) et le lit
avec toi, de haut en bas, pour que chaque ligne ait un sens avant que tu ne la
voies tourner dans l'onglet **Actions** de GitHub.

Ouvre le fichier à côté de cette page — les numéros de section suivent l'ordre
du fichier.

## 0. Le rôle de cette pipeline

Elle sert de **retour rapide** pendant que tu développes : à chaque pull
request, elle vérifie le style, les tests et la qualité, et construit l'image
— sans les scans de sécurité (ça, c'est le rôle de la pipeline DevSecOps,
couverte dans [04-pipeline-devsecops.md](04-pipeline-devsecops.md), qui tourne
à la fusion sur `main`). L'idée : un retour en quelques minutes sur ta PR, pas
en quinze.

## 1. Le déclencheur (`on:`)

```yaml
on:
  pull_request:
    branches: [main]
  workflow_dispatch:
```

- `pull_request: branches: [main]` — la pipeline se lance à chaque ouverture ou
  mise à jour d'une pull request ciblant `main`. C'est tout : elle ne se lance
  **jamais** sur un simple `git push` vers une branche quelconque.
- `workflow_dispatch` — un bouton « Run workflow » apparaît dans l'onglet
  Actions, pour la lancer à la main (utile pour tester, ou pour publier une
  image manuellement — on y revient au job `build`).

## 2. Permissions et concurrence

```yaml
permissions:
  contents: read

concurrency:
  group: devops-${{ github.ref }}
  cancel-in-progress: true
```

- `permissions: contents: read` — par défaut, la pipeline ne peut que **lire**
  le dépôt. Chaque job qui a besoin de plus (écrire dans GHCR, par exemple)
  déclare son propre besoin localement — c'est le principe de moindre
  privilège.
- `concurrency` — si tu pousses deux fois de suite sur la même PR, le premier
  run encore en cours est **annulé** au profit du second. Sans ça, deux runs
  tourneraient en parallèle pour un résultat dont un seul compte vraiment.

## 3. Job `test-qualite` — ESLint

```yaml
test-qualite:
  name: ESLint (${{ matrix.component }})
  strategy:
    matrix:
      component: [frontend, backend]
```

`strategy: matrix` décline **ce même job** une fois par valeur listée : ici,
deux exécutions du job, une avec `component: frontend`, une avec
`component: backend`, sur deux machines en parallèle. GitHub Actions les
affiche groupées sous une carte **« Matrix: test-qualite »** dans le graphe —
c'est le nom de la *clé* du job (`test-qualite:`) qui apparaît là, pas son
`name:` ni un texte que tu choisis.

Les étapes :

1. `actions/checkout@v4` — récupère le code du dépôt sur la machine du job.
2. `actions/setup-node@v4` — installe Node 22, avec un cache npm **par
   composant** (`cache-dependency-path: ${{ matrix.component }}/package-lock.json`)
   pour ne pas mélanger les caches frontend et backend.
3. `npm ci && npm run lint` — installation reproductible (`ci`, pas
   `install` : elle respecte exactement le `package-lock.json`) puis ESLint.
   Le script `lint` du `package.json` est configuré avec `--max-warnings=0` :
   un seul avertissement suffit à faire échouer l'étape.
4. **Résumé** — cette dernière étape a `if: always()` : elle s'exécute même si
   ESLint a échoué juste avant. Elle regarde `steps.eslint.outcome`
   (`success` ou `failure`) et écrit un petit tableau Markdown dans
   `$GITHUB_STEP_SUMMARY`, une variable fournie par GitHub : tout ce qu'on y
   ajoute apparaît dans l'onglet **Summary** du run, pas seulement dans les
   logs bruts.

## 4. Job `test-unitaire` — Jest et Vitest

```yaml
test-unitaire:
  name: ${{ matrix.tool }} (${{ matrix.component }})
  strategy:
    matrix:
      include:
        - component: backend
          tool: Jest
        - component: frontend
          tool: Vitest
```

Différence avec le job précédent : `matrix.include` énumère des **paires**
au lieu d'une simple liste — chaque instance a son propre couple
`component`/`tool`. Le backend est testé avec Jest, le frontend avec Vitest
(un lanceur différent, mais la même façon d'écrire les tests :
`describe`/`it`/`expect`).

Étapes propres à ce job :

- `npm run test:coverage` — lance les tests **et** mesure la couverture de
  code (quel pourcentage du code est réellement exécuté par les tests).
- **Transmettre la couverture au job qualite** — chaque job tourne sur une
  machine neuve et vide ; rien de ce qu'il produit ne survit à sa fin, sauf ce
  qu'on dépose explicitement en **artefact** (`actions/upload-artifact@v4`).
  C'est ce mécanisme qui permet au job `quality` de récupérer ce rapport de
  couverture juste après. `if-no-files-found: warn` évite de faire échouer
  l'étape si les tests ont plané avant de produire le rapport.

## 5. Job `quality` — SonarQube

```yaml
quality:
  name: Test Qualité SonarQube
  needs: [test-qualite, test-unitaire]
  continue-on-error: true
```

- `needs: [test-qualite, test-unitaire]` — ce job **attend** que les deux
  précédents (donc les 4 instances de matrix qu'ils représentent) soient
  terminées, parce qu'il a besoin de leurs rapports de couverture.
- `continue-on-error: true` — si ce job échoue, la pipeline dans son ensemble
  reste verte. La qualité est **mesurée et affichée**, mais ne bloque encore
  personne — un choix assumé pour ne pas décourager en début de projet.

Le job, étape par étape :

1. `download-artifact` (×2) — récupère les deux rapports de couverture
   déposés juste avant, aux emplacements exacts (`backend/coverage`,
   `frontend/coverage`) attendus par [`sonar-project.properties`](../sonar-project.properties).
2. **Démarrer un serveur SonarQube éphémère** — `docker run -d ... sonarqube:...`
   lance un serveur SonarQube **dans le job lui-même**. Pas de compte à
   créer, pas de secret à configurer : ce serveur n'existe que le temps du
   job, sur `localhost:9000`, et disparaît avec lui.
3. **Attendre que SonarQube soit prêt** — une boucle qui interroge
   `/api/system/status` toutes les 5 secondes (jusqu'à 60 fois) jusqu'à
   recevoir `"UP"`. Un conteneur qui *démarre* n'est pas un conteneur *prêt*.
4. **Générer un token d'analyse** — une instance SonarQube neuve accepte les
   identifiants par défaut `admin`/`admin` ; on s'en sert une seule fois pour
   fabriquer un vrai token d'API. `::add-mask::` le masque ensuite dans tous
   les logs (même si ce token ne protège qu'un serveur jetable — bon réflexe
   à garder).
5. **SonarQube — analyse** — l'action officielle envoie le code au serveur.
   `-Dsonar.qualitygate.wait=true` fait attendre le verdict du *Quality Gate*
   (le jugement global : bugs, code smells, couverture...) avant de continuer.
6. **Publier les mesures dans le résumé** — le serveur va disparaître avec le
   job : ce résumé (encore `$GITHUB_STEP_SUMMARY`) est la seule trace qui
   reste. Il interroge l'API SonarQube (`curl` + `jq`) pour extraire Quality
   Gate, bugs, vulnérabilités, couverture, etc., et les affiche en tableau.

> Envie de voir l'interface complète de SonarQube (pas juste le résumé) ?
> Lance le même serveur en local :
> `docker run -d -p 9000:9000 -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true sonarqube:26.7.0.124771-community`
> puis ouvre http://localhost:9000 (identifiants `admin`/`admin`).

## 6. Job `build` — Docker et GHCR

```yaml
build:
  name: Build Docker (${{ matrix.component }})
  needs: [quality]
  permissions:
    packages: write
  strategy:
    matrix:
      component: [frontend, backend]
```

`needs: [quality]` — ce job attend le job `quality` (qui lui-même attendait
les deux précédents) : toute la chaîne doit être passée avant de construire
quoi que ce soit.

1. **Build Docker** (`load: true`) — construit l'image et la charge dans le
   moteur Docker **local** au runner. Rien n'est publié à cette étape.
2. **Registry — connexion à GHCR** et **push vers GHCR** — regarde bien la
   condition sur ces deux étapes :

   ```yaml
   if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'
   ```

   Traduit : *seulement si quelqu'un a cliqué « Run workflow » à la main,
   et seulement sur la branche `main`*. Sur une pull request normale,
   `github.event_name` vaut `pull_request`, donc la condition est fausse et
   ces deux étapes sont **ignorées** (`skipped`) — jamais de publication
   automatique depuis une PR. La publication automatique, elle, est le rôle
   de la pipeline DevSecOps (elle scanne l'image avant de la pousser).
3. **Résumé** — regarde `steps.docker_build.outcome` pour le statut du build,
   puis `steps.registry_push.outcome` : `success` (publiée), `skipped` (pas
   sur main en manuel — normal sur une PR), ou tout le reste (`échec`).

## 7. La voir vivre

1. Crée une branche, modifie un fichier (essaie de casser un test ou
   d'introduire une erreur ESLint volontairement), ouvre une pull request
   vers `main`.
2. Onglet **Actions** : les jobs `test-qualite` et `test-unitaire` démarrent
   en parallèle (4 machines), `quality` attend leur fin, `build` attend
   `quality`.
3. Onglet **Summary** du run : les tableaux de chaque job s'y accumulent,
   avec le statut et les métriques clés — pas besoin d'ouvrir chaque job un
   par un.

## Ce qu'il faut retenir

- Cette pipeline **valide**, elle ne **publie** jamais automatiquement — la
  seule publication possible ici est manuelle (`workflow_dispatch` sur
  `main`), pour la démonstration.
- `strategy: matrix` décline un job par valeur (composant, outil...) ; la clé
  du job devient l'étiquette « Matrix: ... » dans le graphe GitHub Actions.
- `needs:` construit la chaîne : `quality` attend les tests, `build` attend
  `quality`.
- La suite logique : [04-pipeline-devsecops.md](04-pipeline-devsecops.md),
  qui reprend exactement ces 4 jobs et y ajoute la sécurité.
