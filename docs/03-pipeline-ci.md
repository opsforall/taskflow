# Étape 3 — La pipeline DevSecOps (GitHub Actions)

Aux étapes 1 et 2, tu vérifiais tout à la main. Problème : personne ne relance
tous les tests et tous les scans à chaque modification. La **pipeline** le fait
pour nous : GitHub exécute automatiquement la chaîne et **bloque** ce qui ne
passe pas. C'est le « shift-left » : détecter les problèmes au plus tôt, au
moment du commit, pas en production.

## 0. Deux pipelines, deux rôles

Le dépôt en contient **deux**, et elles ne se déclenchent jamais sur le même
événement — c'est le modèle *fast feedback / full gate* :

| Pipeline | Se déclenche | Contient | Durée |
|---|---|---|---|
| [`Pipeline DevOps.yml`](../.github/workflows/Pipeline%20DevOps.yml) | sur chaque **pull request** | 4 jobs : lint, test, qualité, build | courte |
| [`Pipeline DevSecOps.yml`](../.github/workflows/Pipeline%20DevSecOps.yml) | à la fusion sur **`main`** | **la même base** + 5 tests de sécurité + intégration + E2E | longue |

La seconde n'est pas un autre fichier qui fait autre chose : c'est **la même
base, à laquelle on ajoute la sécurité**. C'est tout l'intérêt du mot
« DevSec**Ops** » — la sécurité n'est pas une pipeline séparée qu'on branche à
côté, c'est la pipeline de livraison à laquelle on ajoute des portes.

Pourquoi séparer les déclencheurs ? Pendant que tu itères sur une PR, tu veux un
retour en 3 minutes, pas en 15. Mais rien ne part en production sans la porte
complète. Si les deux tournaient sur les mêmes événements, tout s'exécuterait en
double et elles se disputeraient les mêmes tags d'image.

Les deux fichiers sont très commentés : lis-les en parallèle de cette page.

## 1. L'architecture : fan-out / fan-in

Tous les jobs d'**analyse** partent en parallèle (fan-out). Le **build** attend
qu'ils soient tous verts (fan-in), et l'E2E attend le build :

```
 lint ─┬─▶ quality ─────┐
 test ─┘                │
 integration ───────────┤
 secrets ───────────────┼──▶ build (+ scan image + SBOM) ──▶ e2e
 sca ───────────────────┤
 sast ──────────────────┤
 iac ───────────────────┘
```

Chaque job est une **porte** : s'il échoue, rien ne se construit, rien n'est
publié. `quality` est le seul du fan-out à avoir des dépendances : il consomme
les rapports de couverture produits par `test`.

## 2. Qui vérifie quoi

**La base DevOps** — présente dans les deux pipelines :

| Job | Outil | Question posée |
|---|---|---|
| `lint` | ESLint | mon code respecte-t-il les règles d'écriture ? |
| `test` | Jest (back) / Vitest (front) | ma logique fonctionne-t-elle ? (base simulée) |
| `quality` | SonarQube | quelle est ma dette technique ? |
| `build` | Docker + GHCR | l'image se construit-elle, et où est-elle stockée ? |

**Ce que la DevSecOps ajoute** — 5 tests de sécurité, 1 outil = 1 question :

| Job | Outil | Question posée |
|---|---|---|
| `secrets` | Gitleaks | ai-je committé un mot de passe ? |
| `sca` | Trivy fs | mes **dépendances** ont-elles des failles connues ? |
| `sast` | Semgrep | **mon code** contient-il des failles ? |
| `iac` | Trivy config | mes manifests Kubernetes sont-ils durcis ? |
| `build` | Trivy image | mon **image finale** contient-elle des failles ? |

Plus deux tests fonctionnels :

| Job | Outil | Question posée |
|---|---|---|
| `integration` | Jest + vraie PostgreSQL | l'API et la base se parlent-elles vraiment ? |
| `e2e` | Playwright | un vrai utilisateur peut-il utiliser l'app ? |

**La distinction à retenir**, celle qui structure tout :

- **SCA** = ce que j'**importe** (les bibliothèques des autres)
- **SAST** = ce que j'**écris** (mon propre code)
- **IaC** = ce que je **configure** (mon infrastructure)

Et une nuance souvent confondue : `sca` scanne mes dépendances npm ; `Trivy
image` scanne **tout** le contenu de l'image, y compris les paquets du système
d'exploitation de base (Alpine, nginx). Ce n'est pas le même périmètre.

> Deux jobs ne bloquent volontairement pas : `quality` (`continue-on-error`) —
> la qualité est mesurée et affichée, mais on ne rend le Quality Gate
> obligatoire que quand l'équipe est prête — et le SBOM, qui inventorie sans
> juger. Les 5 tests de sécurité, eux, **bloquent**.

**Particularité du job `quality`** : il n'exige aucun compte ni aucune
configuration. Il démarre son **propre serveur SonarQube jetable** en conteneur,
génère un token via l'API, analyse, publie les chiffres clés (Quality Gate,
bugs, couverture…) dans le **Summary** du run, puis le serveur disparaît avec le
job. Pour explorer l'interface complète, lance le même serveur en local
(`docker run -d -p 9000:9000 -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true
sonarqube:26.7.0.124771-community`, puis http://localhost:9000, identifiants
initiaux `admin`/`admin`). Le jour où l'équipe veut un historique et la
décoration des pull requests, on remplace ce serveur jetable par un vrai
(SonarQube Cloud) : seule l'URL et le token changent.

## 3. Où vont les images ?

Si les 5 portes de sécurité sont vertes **et** qu'on est sur `main` (jamais
depuis une pull request), les images partent sur **GHCR** :
`ghcr.io/opsforall/taskflow-backend` et `taskflow-frontend`, avec 3 tags :
`:<sha>` (traçabilité), `:1.0.0` (référencé par les manifests k8s), `:latest`.
Visibles dans l'onglet **Packages** de l'organisation GitHub.

**L'ordre compte** : on scanne l'image *avant* de la publier. Une image
vulnérable ne doit jamais atteindre le registre.

Chaque image est accompagnée de son **SBOM** (format CycloneDX), téléchargeable
dans les artefacts du run. C'est l'inventaire de tout ce qu'elle contient. Le
scan répond « y a-t-il une faille connue *aujourd'hui* ? » ; le SBOM répond à
une autre question, le jour où une faille grave est publiée : « suis-je
concerné ? » — il suffit de chercher le paquet dans la liste, sans rien
reconstruire. C'est exactement ce qui a manqué à tout le monde pendant
l'incident Log4Shell.

## 4. Voir la pipeline vivre

1. Modifie un fichier, committe, **ouvre une pull request** : onglet
   **Actions**, la pipeline DevOps démarre. Fusionne : c'est la DevSecOps
   complète qui part, jobs en parallèle puis convergence.
2. **Fais-la échouer** (c'est là qu'on apprend) : les dossiers `demo-insecure/`
   et `k8s-insecure/` contiennent des vulnérabilités volontaires à scanner à la
   main, et [CORRECTIONS.md](../CORRECTIONS.md) donne, pour chacune, l'alerte
   attendue et le correctif.

```bash
trivy fs --scanners vuln --severity HIGH,CRITICAL demo-insecure/    # SCA : rouge
semgrep scan --config p/javascript --config p/nodejs demo-insecure/ # SAST : rouge
trivy config --severity HIGH,CRITICAL k8s-insecure/                 # IaC : rouge
trivy config --severity HIGH,CRITICAL k8s/                          # durci : vert
```

## Ce qu'il faut retenir

- La pipeline rejoue **à chaque changement** ce que tu faisais à la main, et
  personne ne peut « oublier » un contrôle : les portes sont bloquantes.
- Retour rapide sur les PR, porte complète avant la livraison : les deux ne
  s'opposent pas, ils se complètent.
- L'humain définit les règles une fois ; la machine les applique toujours.
- La suite logique : déployer ces images sur **Kubernetes** avec les manifests
  du dossier [`k8s/`](../k8s/) (voir le README principal, section déploiement).
