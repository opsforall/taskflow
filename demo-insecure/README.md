# demo-insecure/ - artefacts VOLONTAIREMENT vulnerables (support de cours)

⚠️ **Code jamais execute, jamais importe par l'application.** Ces fichiers servent
uniquement a faire remonter une alerte par chaque outil pendant le TP.

Ce dossier n'est **pas** scanne par la pipeline CI (les jobs `sca` et `sast`
ciblent seulement `frontend/` et `backend/`), pour que la pipeline reste verte.
On lance les scans **a la main** :

```bash
# SAST : concatenation SQL et eval() -> Semgrep doit lever des alertes
semgrep scan --config p/javascript --config p/nodejs demo-insecure/

# SCA : dependance lodash 4.17.4 (CVE connues) -> Trivy doit lever des alertes
trivy fs --scanners vuln --severity HIGH,CRITICAL demo-insecure/
```

Le detail (alerte remontee + correctif a appliquer en direct) est dans
[`../CORRECTIONS.md`](../CORRECTIONS.md).

Note sur le secret : on NE committe PAS de fausse cle d'API ici, car Gitleaks
scanne tout le depot et son historique, ce qui rendrait la pipeline rouge en
permanence. La demo Gitleaks se fait en exercice (voir CORRECTIONS.md).
