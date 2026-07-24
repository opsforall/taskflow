# k8s-insecure/ — manifests VOLONTAIREMENT vulnérables (support de cours)

⚠️ **Ne JAMAIS déployer ces manifests.** Ils existent uniquement pour faire
échouer un scan de configuration (Trivy config) et illustrer, par contraste, la
version durcie du dossier [`k8s/`](../k8s/).

Ce dossier n'est **pas** scanné par la pipeline CI (le job `iac-scan` cible
seulement `k8s/`), pour que la pipeline reste verte. Ici, on lance le scan **à la
main** pendant le TP :

```bash
# Scan de la version vulnérable : doit remonter plusieurs alertes HIGH/CRITICAL
trivy config --severity HIGH,CRITICAL k8s-insecure/

# Scan de la version durcie, pour comparaison : doit être vert
trivy config --severity HIGH,CRITICAL k8s/
```

Le fichier [`insecure-manifests.yaml`](insecure-manifests.yaml) commente, ligne
par ligne, quelle mauvaise pratique déclenche quelle règle. Le détail des
corrections est dans [`../CORRECTIONS.md`](../CORRECTIONS.md).
