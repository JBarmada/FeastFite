#!/usr/bin/env bash
# apply-all.sh — applies all k8s manifests in dependency order.
# Run once after cluster creation, or after making manifest changes.
#
# Prerequisites:
#   - kubectl configured for your GKE cluster (gcloud container clusters get-credentials ...)
#   - Secrets already created via k8s/secrets.template.yml instructions
#
# Usage:
#   bash k8s/apply-all.sh

set -euo pipefail

echo "→ Namespace"
kubectl apply -f k8s/namespace.yml

echo "→ ConfigMap"
kubectl apply -f k8s/configmap.yml

echo "→ Infrastructure (Postgres, Redis, RabbitMQ, MinIO)"
kubectl apply -f k8s/infra/

echo "  Waiting for infra to be ready..."
kubectl rollout status statefulset/postgres-auth      -n feastfite --timeout=120s
kubectl rollout status statefulset/postgres-territory -n feastfite --timeout=120s
kubectl rollout status statefulset/postgres-vote      -n feastfite --timeout=120s
kubectl rollout status statefulset/postgres-economy   -n feastfite --timeout=120s
kubectl rollout status statefulset/postgres-profile   -n feastfite --timeout=120s
kubectl rollout status statefulset/redis              -n feastfite --timeout=120s
kubectl rollout status statefulset/rabbitmq           -n feastfite --timeout=120s
kubectl rollout status statefulset/minio              -n feastfite --timeout=120s

echo "→ Services"
kubectl apply -f k8s/auth/
kubectl apply -f k8s/territory/
kubectl apply -f k8s/vote/
kubectl apply -f k8s/economy/
kubectl apply -f k8s/profile/

echo "→ API Gateway (Kong)"
kubectl apply -f k8s/gateway/

echo "→ Frontend"
kubectl apply -f k8s/frontend/

echo "→ Ingress"
kubectl apply -f k8s/ingress.yml

echo ""
echo "✓ All manifests applied."
echo ""
echo "Check pod status:   kubectl get pods -n feastfite"
echo "Get ingress IP:     kubectl get ingress -n feastfite"
echo "View logs:          kubectl logs -n feastfite deployment/auth-service"
