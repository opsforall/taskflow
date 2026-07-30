#!/usr/bin/env bash
# Tests de bout en bout du deploiement TaskFlow (labs 01 a 07).
#
# Usage :
#   bash kubernetes/lab08/test.sh
#
# Sortie 0 = deploiement complet et fonctionnel. Toute assertion en echec
# arrete le script avec un message explicite.
set -euo pipefail

NS=taskflow
CURL_IMAGE=curlimages/curl:8.10.1
FAILURES=0

info() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
ok() { printf '\033[0;32m  OK\033[0m   %s\n' "$1"; }
ko() {
  printf '\033[0;31m  KO\033[0m   %s\n' "$1"
  FAILURES=$((FAILURES + 1))
}

# check <description> <commande...>
check() {
  local desc=$1
  shift
  if "$@" >/dev/null 2>&1; then
    ok "$desc"
  else
    ko "$desc"
  fi
}

# expect <description> <valeur attendue> <valeur obtenue>
expect() {
  local desc=$1 want=$2 got=$3
  if [ "$want" = "$got" ]; then
    ok "$desc (= $got)"
  else
    ko "$desc : attendu '$want', obtenu '$got'"
  fi
}

# curl_in_cluster <nom-du-pod> <url> : execute curl depuis un pod ephemere.
# --retry : apres un rollout, le Service met parfois quelques secondes a router
# vers les nouvelles IP de pods ; sans reessai le test echoue par intermittence.
curl_in_cluster() {
  kubectl -n "$NS" run "$1" --image="$CURL_IMAGE" --rm -i --restart=Never --quiet \
    -- curl -fsS --connect-timeout 5 --retry 10 --retry-delay 3 --retry-all-errors "$2"
}

info "Lab 01 - Namespace"
check "le namespace $NS existe" kubectl get namespace "$NS"
expect "label app.kubernetes.io/name" "taskflow" \
  "$(kubectl get namespace "$NS" -o jsonpath='{.metadata.labels.app\.kubernetes\.io/name}')"

info "Lab 02 - ConfigMaps et Secrets"
check "ConfigMap backend-config" kubectl -n "$NS" get configmap backend-config
check "Secret postgres-secret" kubectl -n "$NS" get secret postgres-secret
check "Secret backend-secret" kubectl -n "$NS" get secret backend-secret
expect "backend-config.DB_HOST" "postgres" \
  "$(kubectl -n "$NS" get configmap backend-config -o jsonpath='{.data.DB_HOST}')"
# Le backend et la base doivent partager le meme mot de passe, sinon la
# readiness probe /api/health/ready ne passera jamais.
expect "DB_PASSWORD == POSTGRES_PASSWORD" \
  "$(kubectl -n "$NS" get secret postgres-secret -o jsonpath='{.data.POSTGRES_PASSWORD}')" \
  "$(kubectl -n "$NS" get secret backend-secret -o jsonpath='{.data.DB_PASSWORD}')"

info "Lab 03 - PostgreSQL (StatefulSet + Service headless)"
check "StatefulSet postgres" kubectl -n "$NS" get statefulset postgres
kubectl -n "$NS" rollout status statefulset/postgres --timeout=240s
expect "Service postgres headless" "None" \
  "$(kubectl -n "$NS" get svc postgres -o jsonpath='{.spec.clusterIP}')"
expect "PVC data-postgres-0 provisionne" "Bound" \
  "$(kubectl -n "$NS" get pvc data-postgres-0 -o jsonpath='{.status.phase}')"
check "la base accepte les connexions" \
  kubectl -n "$NS" exec postgres-0 -- pg_isready -U taskflow -d taskflow

info "Lab 04 - Backend (Deployment + Service)"
kubectl -n "$NS" rollout status deployment/backend --timeout=240s
expect "backend availableReplicas" "2" \
  "$(kubectl -n "$NS" get deploy backend -o jsonpath='{.status.availableReplicas}')"
check "Service backend possede des endpoints" \
  kubectl -n "$NS" get endpointslices -l kubernetes.io/service-name=backend \
    -o jsonpath='{.items[0].endpoints[0].addresses[0]}'
check "GET http://backend:3000/api/health" \
  curl_in_cluster api-health "http://backend:3000/api/health"
# /api/health/ready interroge la base : ce test valide la chaine backend -> postgres
check "GET http://backend:3000/api/health/ready (DB joignable)" \
  curl_in_cluster api-ready "http://backend:3000/api/health/ready"

info "Lab 05 et 06 - Frontend (ConfigMap + Deployment + Service)"
check "ConfigMap frontend-config" kubectl -n "$NS" get configmap frontend-config
kubectl -n "$NS" rollout status deployment/frontend --timeout=240s
expect "frontend availableReplicas" "2" \
  "$(kubectl -n "$NS" get deploy frontend -o jsonpath='{.status.availableReplicas}')"
expect "Service frontend 80 -> 8080" "8080" \
  "$(kubectl -n "$NS" get svc frontend -o jsonpath='{.spec.ports[0].targetPort}')"
check "GET http://frontend/ sert la SPA" curl_in_cluster front-root "http://frontend/"
# config.js est genere au demarrage du conteneur depuis APP_COLOR (ConfigMap).
# S'il contient la couleur attendue, l'injection a l'execution fonctionne.
APP_COLOR_CM="$(kubectl -n "$NS" get configmap frontend-config -o jsonpath='{.data.APP_COLOR}')"
if curl_in_cluster front-config "http://frontend/config.js" 2>/dev/null | grep -q "$APP_COLOR_CM"; then
  ok "config.js expose APP_COLOR=$APP_COLOR_CM (injection a l'execution)"
else
  ko "config.js n'expose pas APP_COLOR=$APP_COLOR_CM"
fi

info "Resultat"
if [ "$FAILURES" -eq 0 ]; then
  printf '\033[0;32mTous les tests TaskFlow sont passes.\033[0m\n'
  exit 0
fi
printf '\033[0;31m%s test(s) en echec.\033[0m\n' "$FAILURES"
exit 1
