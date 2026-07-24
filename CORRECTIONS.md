# CORRECTIONS.md - guide du formateur

Ce document accompagne les artefacts volontairement vulnerables du projet. Pour
chaque outil de la chaine DevSecOps, il donne : la commande pour reproduire
l'alerte, ce que l'outil remonte, et le correctif a appliquer en direct.

Rappel de conception : le code principal (`frontend/`, `backend/`, `k8s/`) est
**sain**, donc la pipeline CI passe au **vert**. Les vulnerabilites vivent dans
des dossiers **isoles** (`demo-insecure/`, `k8s-insecure/`) que la pipeline ne
scanne pas. On les scanne **a la main** pendant le cours pour voir le rouge,
puis on compare avec la version saine.

Deroule suggere : on lance d'abord le pipeline **permissif** (`ci-permissif.yml`,
declenchement manuel) pour voir les alertes sans blocage, on corrige, puis on
bascule sur le pipeline **bloquant** (`ci.yml`) ou tout doit etre vert.

---

## 1. SCA (Software Composition Analysis) - Trivy fs

**Ce que ca teste** : les vulnerabilites connues (CVE) des DEPENDANCES tierces.

**Reproduire l'alerte :**

```bash
trivy fs --scanners vuln --severity HIGH,CRITICAL demo-insecure/
```

**Alerte remontee** : la dependance `lodash@4.17.4` (dans
`demo-insecure/package.json`) porte 5 CVE, dont :

- `CVE-2019-10744` (CRITICAL) : prototype pollution dans `defaultsDeep`
- `CVE-2018-16487`, `CVE-2020-8203` (HIGH) : prototype pollution

**Correctif** : mettre a jour vers une version corrigee.

```bash
# dans demo-insecure/
npm install lodash@^4.17.21
```

Puis relancer le scan : plus aucune alerte. Point de cours : la SCA ne corrige
pas le code, elle suit les versions ; d'ou l'interet de Dependabot pour
automatiser ces montees de version.

---

## 2. SAST (Static Application Security Testing) - Semgrep

**Ce que ca teste** : les failles dans le CODE qu'on ecrit (pas les dependances).

**Reproduire l'alerte :**

```bash
semgrep scan --config p/javascript --config p/nodejs demo-insecure/
```

**Alerte remontee** : dans `demo-insecure/vulnerable-query.js`

- `eval(req.query.expr)` : execution de code arbitraire a partir d'une entree
  utilisateur (regle `detect-eval-with-expression`). C'est la faille que les
  regles standard bloquent de facon fiable.
- La concatenation SQL (`"... WHERE name = '" + name + "'"`) illustre la meme
  logique d'injection ; selon les regles activees (ex. `p/owasp-top-ten`), elle
  est aussi detectee.

**Correctifs :**

- Ne jamais utiliser `eval` sur une entree : parser la valeur avec un module dedie.
- Requetes SQL PARAMETREES, comme dans le vrai backend
  (`backend/src/routes/tasks.js`) :

```js
// Vulnerable :
const q = "SELECT * FROM users WHERE name = '" + name + "'";
// Corrige :
const q = 'SELECT * FROM users WHERE name = $1';
await db.query(q, [name]); // la valeur ne peut plus modifier la structure SQL
```

Point de cours : SCA et SAST sont COMPLEMENTAIRES. La SCA n'aurait rien vu ici
(le code est a nous, pas une dependance) ; le SAST n'aurait rien vu sur lodash.

---

## 3. Secret scanning - Gitleaks (en exercice)

**Ce que ca teste** : les secrets (cles d'API, mots de passe) committes dans le
code ou l'historique git.

**Pourquoi un exercice et pas un fichier fourni** : Gitleaks scanne tout le depot
ET son historique. Committer une fausse cle rendrait la pipeline rouge en
permanence (le secret reste dans l'historique meme apres suppression). On le fait
donc en direct :

```bash
# 1. Ajouter une fausse cle dans un fichier, par exemple backend/src/config.js :
#    const STRIPE_KEY = "sk_live_51H8xExampleFakeKey1234567890abcdef";

# 2. Lancer Gitleaks : il doit lever une alerte
gitleaks git . --redact --verbose

# 3. Retirer la ligne. Attention : si elle a ete COMMITTEE, elle reste dans
#    l'historique ; Gitleaks la verra encore. Il faut alors reecrire l'historique
#    (git rebase / git filter-repo) et, en vrai, REVOQUER la cle exposee.
```

**Correctif de fond** : ne jamais mettre de secret dans le code. Utiliser des
variables d'environnement (voir `.env.example`), un Secret Kubernetes, ou un
gestionnaire de secrets (Vault, AWS Secrets Manager, ...).

---

## 4. IaC / manifests - Trivy config

**Ce que ca teste** : les mauvaises configurations des manifests Kubernetes.

**Reproduire l'alerte :**

```bash
trivy config --severity HIGH,CRITICAL k8s-insecure/
```

**Alertes remontees** (6 HIGH) sur `k8s-insecure/insecure-manifests.yaml` :

| Regle | Probleme | Correctif (voir k8s/) |
|-------|----------|------------------------|
| KSV017 | `privileged: true` | `privileged: false` (ou ne pas le mettre) |
| KSV005 | capacite `SYS_ADMIN` ajoutee | `capabilities.drop: ["ALL"]` |
| KSV014 | `readOnlyRootFilesystem` absent | `readOnlyRootFilesystem: true` + volumes emptyDir |
| KSV118 | securityContext par defaut (root) | `runAsNonRoot: true`, `runAsUser` explicite |
| KSV109 | secret stocke dans un ConfigMap | utiliser un `Secret` |
| KSV121 | volume `hostPath: /` | supprimer le hostPath |

**Comparaison** : le meme scan sur la version durcie est vert.

```bash
trivy config --severity HIGH,CRITICAL k8s/   # 0 alerte
```

Point de cours : la version durcie (`k8s/`) applique exactement les correctifs de
la colonne de droite. C'est le "avant / apres" du durcissement d'infrastructure.

---

## Recapitulatif : quel outil attrape quoi

| Outil | Famille | Cible | Faille de demo |
|-------|---------|-------|----------------|
| Trivy fs | SCA | dependances | lodash 4.17.4 (CVE) |
| Semgrep | SAST | code applicatif | eval(), concatenation SQL |
| Gitleaks | Secrets | depot + historique | fausse cle d'API (exercice) |
| Trivy config | IaC | manifests k8s | privileged, hostPath, secret en ConfigMap... |
| Trivy image | Image | image Docker construite | CVE de l'OS / des paquets de base |

Chaque outil couvre une surface differente : c'est leur COMBINAISON qui donne une
chaine DevSecOps complete.
