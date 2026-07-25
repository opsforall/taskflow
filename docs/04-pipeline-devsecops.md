# Étape 4 — La pipeline DevSecOps, pas à pas

Cette page suit la même méthode que la précédente
([03-pipeline-devops.md](03-pipeline-devops.md)) : on ouvre
[`Pipeline DevSecOps.yml`](../.github/workflows/Pipeline%20DevSecOps.yml) et on
le lit de haut en bas. Si tu n'as pas encore lu la page précédente, fais-le
d'abord — cette pipeline **reprend exactement** les 4 jobs qui y sont
expliqués (`test-qualite`, `test-unitaire`, `quality`, `build`) et n'ajoute
que ce que cette page couvre : `integration`, `securite` et `e2e`.

## 0. Le rôle de cette pipeline

Direction, dans son nom : « DevSec**Ops** ». Ce n'est pas une pipeline
séparée qui ferait « autre chose » — c'est la pipeline DevOps de la page
précédente, à laquelle on ajoute des portes de sécurité. C'est la **porte
complète** : elle ne tourne qu'à la fusion sur `main` (ou à la demande), pas
sur chaque pull request — trop lente pour un retour rapide, mais c'est elle
qui décide si une image part réellement en registre.

```yaml
on:
  pull_request:
    branches: [main]
  workflow_dispatch:
```

(Le fichier tourne aussi sur `pull_request` pendant que tu apprends et que tu
n'as pas encore de vrai flux de fusion sur `main` — mais retiens l'intention :
en usage réel, cette pipeline est celle du merge, l'autre celle de la PR.)

## 1. Les 4 jobs déjà connus

`test-qualite`, `test-unitaire`, `quality` et `build` apparaissent presque à
l'identique — mêmes étapes, mêmes explications que dans
[03-pipeline-devops.md](03-pipeline-devops.md). Deux différences à repérer en
comparant les deux fichiers :

- `build` gagne ici deux étapes supplémentaires (scan de l'image + SBOM,
  détaillées en section 4) et publie **sans condition** sur `main` — pas de
  `workflow_dispatch` à cocher, c'est la voie normale de publication.
- Le graphe entier converge maintenant vers ce même `build`, qui attend en
  plus `integration` et `securite`.

## 2. Job `integration` — Jest contre une vraie PostgreSQL

```yaml
integration:
  name: Test d'intégration Jest + PostgreSQL
  needs: [test-unitaire]
  services:
    postgres:
      image: postgres:16.4-alpine
      ...
```

Différence avec le job `test-unitaire` de la page précédente : celui-là
**simule** la base de données (elle n'existe pas vraiment) ; celui-ci lui
parle pour de vrai.

- `services:` — démarre un **conteneur PostgreSQL à côté du job**, sur le
  réseau du runner. `options: --health-cmd "pg_isready ..."` fait que GitHub
  attend que la base réponde réellement avant de lancer l'étape suivante.
- `needs: [test-unitaire]` — c'est une **vraie** dépendance, pas cosmétique :
  inutile de payer le coût d'une vraie base (et des tests plus lents) si les
  tests unitaires échouent déjà. Conséquence assumée : ce job démarre après
  les tests unitaires, il n'est plus strictement en parallèle avec le reste.
- L'étape `Jest` tourne avec des variables d'environnement (`DB_HOST`,
  `DB_PORT`...) qui pointent vers ce service Postgres, alors que les tests
  unitaires n'en avaient besoin d'aucune (tout y est simulé/mocké).

## 3. Job `securite` — 5 tests fusionnés dans un seul job matrix

C'est le job le plus dense du fichier, et le seul qui demande une explication
avant de lire le code : **pourquoi cinq outils différents partagent un seul
bloc de steps ?**

GitHub Actions ne regroupe visuellement sous un titre commun que les jobs
utilisant `strategy: matrix` (carte « Matrix: securite »). C'est le **seul**
mécanisme de regroupement qui existe — il n'y a pas d'autre moyen de dire
« ces 5 tests vont ensemble » dans le graphe. Pour obtenir cette carte
unique, les 5 tests sont donc écrits comme les 5 *instances* d'un même job,
plutôt que comme 5 jobs séparés.

```yaml
securite:
  name: ${{ matrix.label }}
  strategy:
    matrix:
      include:
        - id: secrets
          label: Secrets Gitleaks
          tool: Gitleaks
        - id: deps
          label: Dépendances Trivy fs (frontend)
          tool: Trivy fs
          component: frontend
        - id: deps
          label: Dépendances Trivy fs (backend)
          ...
        - id: sast
          label: SAST Semgrep
          ...
        - id: config
          label: Configuration Trivy config
          ...
```

Cinq instances, chacune avec un `id` différent. Plus bas, **chaque étape** du
job porte une condition qui la réserve à la bonne instance :

```yaml
- name: Gitleaks - un secret a-t-il fuite dans git ?
  if: matrix.id == 'secrets'
  ...
- name: Trivy - mes dépendances ont-elles des CVE ?
  if: matrix.id == 'deps'
  ...
```

Concrètement, pour l'instance `id: secrets`, seule l'étape Gitleaks
s'exécute — les 4 autres valent `skipped` (elles ne tournent pas, mais
apparaissent quand même dans les logs). Pour l'instance `id: deps` avec
`component: frontend`, c'est l'inverse : seule l'étape Trivy s'exécute. Un
seul job à lire dans le graphe, au prix de conditions à suivre au lieu d'un
mapping direct « un job = un outil ».

Les 4 outils, avec la question posée par chacun :

| `matrix.id` | Outil | Question |
|---|---|---|
| `secrets` | Gitleaks | ai-je committé un mot de passe, une clé d'API ? |
| `deps` | Trivy fs | mes **dépendances** ont-elles des CVE connues ? |
| `sast` | Semgrep | **mon code** contient-il des failles ? |
| `config` | Trivy config | mes manifests Kubernetes sont-ils durcis ? |

**La distinction à retenir** :
- **SCA** (`deps`) = ce que j'**importe** (les bibliothèques des autres)
- **SAST** = ce que j'**écris** (mon propre code)
- **IaC** (`config`) = ce que je **configure** (mon infrastructure)

Détails qui valent le coup d'œil :

- `fetch-depth: 0` sur le checkout — nécessaire pour Gitleaks (il doit lire
  **tout l'historique** git, pas juste le dernier commit : un secret supprimé
  hier reste lisible dans un commit d'avant-hier), sans effet sur les 4
  autres instances qui n'ont besoin que du code actuel.
- Le dossier `k8s-insecure/` est volontairement exclu du scan `config` — il
  sert de démo « scan rouge », à lancer à la main (section 6).
- Le **résumé**, en bas du job, doit deviner laquelle des 4 étapes a
  réellement tourné : il regarde les 4 `outcome` possibles et retient celui
  qui n'est pas `skipped`.

## 4. Job `build` — ce qui change par rapport à la page précédente

Même squelette que dans [03-pipeline-devops.md](03-pipeline-devops.md)
(`docker build` local, puis push), avec deux étapes en plus, **avant** la
publication :

```yaml
- name: Trivy - mon image finale est-elle saine ?
  image-ref: ...
  severity: HIGH,CRITICAL
  exit-code: "1"
```

Différence avec le test `deps` du job `securite` : celui-là scanne tes
dépendances npm (`package-lock.json`) ; celui-ci scanne **tout le contenu de
l'image** construite — y compris les paquets du système d'exploitation de
base (Alpine, nginx...). Deux périmètres différents, deux réponses
différentes possibles.

```yaml
- name: SBOM - inventaire du contenu de l'image
  format: cyclonedx
  exit-code: "0"
```

Un **SBOM** (Software Bill of Materials) est l'inventaire complet de ce que
contient l'image, versions comprises. Ce n'est pas un scan (`exit-code: "0"`
— il ne bloque jamais) : c'est une photo. Le scan Trivy juste au-dessus
répond « y a-t-il une faille connue *aujourd'hui* ? » ; le SBOM permet de
répondre, le jour où une faille grave est publiée (type Log4Shell), « suis-je
concerné ? » — il suffit de chercher le paquet dans la liste, sans rien
reconstruire.

Et la publication, ici, n'a **pas** de condition sur `workflow_dispatch` :
elle se fait dès que le job y arrive — c'est-à-dire seulement après que
`test-qualite`, `test-unitaire`, `quality`, `integration` et `securite` sont
tous verts. L'ordre compte : on scanne l'image *avant* de la publier, jamais
l'inverse.

## 5. Job `e2e` — Playwright sur la stack déployée

Dernier maillon, et le seul qui ne regarde ni le code, ni les dépendances, ni
l'image — mais l'application qui **tourne réellement**.

1. **Démarrer la stack complète** — `docker compose up -d --build` lance
   toute l'application (base + API + front) telle qu'elle tournerait chez un
   utilisateur.
2. **Attendre que l'application soit prête** — même logique que l'attente de
   SonarQube (page précédente) : une boucle qui interroge
   `/api/health/ready` (backend) et `/` (frontend) jusqu'à recevoir `200`
   des deux côtés.
3. **Playwright** — pilote un vrai navigateur (Chromium) et clique dans
   l'application comme le ferait un utilisateur : connexion, création de
   tâche, etc.
4. **Logs de la stack (si échec)** — `if: failure()` : ces logs ne
   s'affichent que si quelque chose a mal tourné, pour diagnostiquer sans
   polluer un run qui a réussi.
5. **Arrêter la stack** — `if: always()` : le nettoyage a lieu même en cas
   d'échec, pour ne pas laisser tourner des conteneurs orphelins sur le
   runner.

## 6. Faire échouer la pipeline exprès (c'est là qu'on apprend)

Une pipeline **verte** n'apprend rien. Deux dossiers du dépôt existent
uniquement pour ça — ils contiennent des vulnérabilités volontaires, et la
pipeline ne les scanne **jamais** automatiquement :

```bash
trivy fs --scanners vuln --severity HIGH,CRITICAL demo-insecure/    # SCA : rouge
semgrep scan --config p/javascript --config p/nodejs demo-insecure/ # SAST : rouge
trivy config --severity HIGH,CRITICAL k8s-insecure/                 # IaC : rouge
trivy config --severity HIGH,CRITICAL k8s/                          # durci : vert
```

[CORRECTIONS.md](../CORRECTIONS.md) donne, pour chaque vulnérabilité,
l'alerte exacte attendue et le correctif — compare avec les versions saines
du dépôt (`backend/`, `k8s/`) pour comprendre ce qui a changé.

## Ce qu'il faut retenir

- Cette pipeline est la même base que `Pipeline DevOps.yml`, avec la sécurité
  ajoutée par-dessus — pas un fichier concurrent.
- Les 5 tests de sécurité sont regroupés dans **un seul job matrix**
  (`securite`) : le prix de la carte unique dans le graphe est une étape
  conditionnelle par outil au lieu d'un job dédié par outil.
- `integration` et `build` ont de vraies dépendances (`needs:`) qui reflètent
  un vrai ordre logique (pas de sens à tester l'intégration si les tests
  unitaires échouent ; pas de sens à publier une image non scannée).
- `e2e` est la seule vérification qui regarde l'application **en marche**,
  pas son code ni son image.
- La suite logique : déployer ces images sur **Kubernetes** avec les
  manifests du dossier [`k8s/`](../k8s/) (voir le README principal, section
  déploiement).
