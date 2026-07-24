// Valeurs par défaut pour le développement local.
// Dans le conteneur, ce fichier est REMPLACÉ au démarrage par
// docker/40-inject-env.sh à partir des variables d'environnement :
// c'est ce qui permet de changer la couleur via `docker run -e APP_COLOR=red`
// ou via une ConfigMap Kubernetes, sans rebuilder l'image.
window.__ENV__ = { APP_COLOR: '' };
