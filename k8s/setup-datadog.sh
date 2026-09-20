#!/bin/bash

# Datadog Setup Script for EKS Cluster
# Cluster: chase | Environment: dev | Site: datadoghq.com (US1)

set -e

# Check for required environment variable
if [ -z "$DD_API_KEY" ]; then
  echo "Error: DD_API_KEY environment variable is not set"
  echo "Usage: DD_API_KEY=your_api_key ./setup-datadog.sh"
  exit 1
fi

echo "==> Adding Datadog Helm repository..."
helm repo add datadog https://helm.datadoghq.com
helm repo update

echo "==> Creating datadog namespace..."
kubectl create namespace datadog --dry-run=client -o yaml | kubectl apply -f -

echo "==> Installing Datadog Operator..."
helm upgrade --install datadog-operator datadog/datadog-operator \
  --namespace datadog \
  --wait

echo "==> Creating Datadog API key secret..."
kubectl create secret generic datadog-secret \
  --from-literal api-key="$DD_API_KEY" \
  --namespace datadog \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Deploying Datadog Agent..."
kubectl apply -f datadog-agent.yaml -n datadog

echo "==> Waiting for Datadog Agent to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/datadog-agent -n datadog 2>/dev/null || true

echo ""
echo "Datadog setup complete!"
echo "  Cluster: chase"
echo "  Environment: dev"
echo "  Site: datadoghq.com (US1)"
echo ""
echo "To verify: kubectl get pods -n datadog"
