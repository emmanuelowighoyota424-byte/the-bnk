# Datadog Kubernetes Setup

Deploy Datadog monitoring to your EKS cluster.

## Configuration

| Setting | Value |
|---------|-------|
| Cluster name | `chase` |
| Environment | `dev` |
| Datadog site | `datadoghq.com` (US1) |
| Features | APM, Logs, OTLP |

## Prerequisites

- `kubectl` configured with access to your EKS cluster
- `helm` v3+ installed
- Datadog API key

## Quick Setup

```bash
# Set your API key
export DD_API_KEY=your_api_key_here

# Run the setup script
chmod +x setup-datadog.sh
./setup-datadog.sh
```

## Manual Setup

### 1. Install Datadog Operator

```bash
helm repo add datadog https://helm.datadoghq.com
helm repo update
helm install datadog-operator datadog/datadog-operator \
  --namespace datadog \
  --create-namespace
```

### 2. Create API Key Secret

```bash
kubectl create secret generic datadog-secret \
  --from-literal api-key=YOUR_API_KEY \
  --namespace datadog
```

### 3. Deploy the Agent

```bash
kubectl apply -f datadog-agent.yaml -n datadog
```

## Verify Installation

```bash
# Check pods
kubectl get pods -n datadog

# Check agent status
kubectl exec -it $(kubectl get pods -n datadog -l app.kubernetes.io/name=datadog -o jsonpath='{.items[0].metadata.name}') -n datadog -- agent status
```

## Features Enabled

- **APM**: Application Performance Monitoring with auto-instrumentation
- **Logs**: Container log collection
- **OTLP**: OpenTelemetry collector (gRPC: 4317, HTTP: 4318)

### Auto-Instrumentation Libraries

| Language | Version |
|----------|---------|
| Java | v1 |
| Python | v4 |
| JavaScript | v5 |
| PHP | v1 |
| .NET | v3 |
| Ruby | v2 |
