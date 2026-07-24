# Étape 3 — La pipeline DevSecOps (GitHub Actions)

Aux étapes 1 et 2, tu vérifiais tout à la main. Problème : personne ne relance
tous les tests et tous les scans à chaque modification. La **pipeline** le fait
pour nous : à chaque `git push`, GitHub exécute automatiquement la chaîne
complète, et **bloque** ce qui ne passe pas. C'est le « shift-left » : détecter
les problèmes au plus tôt, au moment du commit, pas en production.

Le fichier : [`.github/workflows/Pipeline DevSecOps.yml`](../.github/workflows/Pipeline%20DevSecOps.yml)
(très commenté, lis-le en parallèle).

## 1. L'architecture : fan-out / fan-in

Tous les jobs d'**analyse** partent en parallèle (fan-out). Le **build** attend
qu'ils soient tous verts (fan-in), et l'E2E attend le build :

```
 lint ─┐
 test ─┤
 integration ─┤
 secrets ─────┼──▶ build (+ scan image) ──▶ e2e
 sca ─────────┤
 sast ────────┤
 iac-scan ────┘
```

Chaque job est une **porte** : s'il échoue, rien ne se construit, rien n'est
publié.

## 2. Qui vérifie quoi

| Job | Outil | Question posée |
|---|---|---|
| `lint` | ESLint + Prettier | le code est-il propre et cohérent ? |
| `test` | Jest / Vitest | la logique fonctionne-t-elle ? (base simulée) |
| `integration` | Jest + vraie PostgreSQL | l'API et la base se parlent-elles vraiment ? |
| `secrets` | Gitleaks | un mot de passe a-t-il fuité dans git ? |
| `sca` | Trivy fs | mes **dépendances** ont-elles des CVE connues ? |
| `sast` | Semgrep | **mon code** contient-il des failles (injection...) ? |
| `iac-scan` | Trivy config | mes manifests k8s sont-ils durcis ? |
| `build` | Docker + Trivy image | l'image finale est-elle saine ? |
| `e2e` | Playwright | un vrai utilisateur peut-il utiliser l'app déployée ? |

La distinction à retenir : **SCA** audite ce que tu importes, **SAST** audite ce
que tu écris. Deux familles de failles, deux outils.

## 3. Où vont les images ?

Si tout est vert **et** qu'on est sur `main` (jamais depuis une pull request),
les images partent sur **GHCR** : `ghcr.io/opsforall/taskflow-backend` et
`taskflow-frontend`, avec 3 tags : `:<sha>` (traçabilité), `:1.0.0` (référencé
par les manifests k8s), `:latest`. Visibles dans l'onglet **Packages** de
l'organisation GitHub.

## 4. Voir la pipeline vivre

1. Modifie un fichier, committe, pousse : onglet **Actions**, regarde les jobs
   s'exécuter en parallèle puis converger.
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

- La pipeline rejoue **à chaque push** ce que tu faisais à la main, et personne
  ne peut « oublier » un contrôle : les portes sont bloquantes.
- L'humain définit les règles une fois ; la machine les applique toujours.
- La suite logique : déployer ces images sur **Kubernetes** avec les manifests
  du dossier [`k8s/`](../k8s/) (voir le README principal, section déploiement).
