# Deploying Voice Liveness API to Fly.io

This guide covers deploying the WavLM + AASIST voice liveness detection service to Fly.io.

## Prerequisites

1. [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) installed
2. Fly.io account (sign up at https://fly.io)
3. PostgreSQL database (Fly Postgres or external)

## Step 1: Install Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

## Step 2: Authenticate

```bash
fly auth signup  # New account
# or
fly auth login   # Existing account
```

## Step 3: Create Dockerfile

Create `Dockerfile` in the `ml-liveness-api` directory:

```dockerfile
FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download models during build (optional - can also download at runtime)
# RUN python -c "from transformers import WavLMModel; WavLMModel.from_pretrained('microsoft/wavlm-base-plus')"

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Step 4: Create fly.toml

```bash
fly launch --name voice-liveness-api --no-deploy
```

Or create `fly.toml` manually:

```toml
app = "voice-liveness-api"
primary_region = "ord"  # Chicago - adjust to your needs

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8000"
  LIVENESS_THRESHOLD = "0.5"
  MAX_AUDIO_DURATION = "30"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[http_service.checks]]
  grace_period = "60s"
  interval = "30s"
  method = "GET"
  timeout = "10s"
  path = "/health"

[[vm]]
  cpu_kind = "shared"
  cpus = 2
  memory_mb = 4096  # 4GB RAM for ML models

# For GPU inference (optional - requires Fly GPU access)
# [[vm]]
#   cpu_kind = "performance"
#   cpus = 4
#   memory_mb = 8192
#   gpu_kind = "a10"  # NVIDIA A10
```

## Step 5: Create Fly Postgres Database

```bash
# Create a Postgres cluster
fly postgres create --name voice-liveness-db

# Attach to your app (sets DATABASE_URL automatically)
fly postgres attach voice-liveness-db --app voice-liveness-api
```

Or use an external database:

```bash
fly secrets set DATABASE_URL="postgresql://user:pass@host:5432/dbname"
```

## Step 6: Set Secrets

```bash
# Required secrets
fly secrets set JWT_SECRET="your-super-secret-key-at-least-32-characters-long"

# Optional: External database
fly secrets set DATABASE_URL="postgresql://..."

# Optional: Allowed origins for CORS
fly secrets set ALLOWED_ORIGINS="https://your-app.vercel.app,https://yourdomain.com"

# Optional: Model paths (if using custom models)
fly secrets set WAVLM_MODEL_PATH="/models/wavlm-base-plus"
fly secrets set AASIST_MODEL_PATH="/models/aasist-best.pt"
```

## Step 7: Deploy

```bash
fly deploy
```

### Monitor Deployment

```bash
# View logs
fly logs

# Check status
fly status

# Open in browser
fly open
```

## Step 8: Configure Next.js Integration

Update your Next.js app environment:

```bash
# In your Next.js project
VOICE_LIVENESS_API_URL=https://voice-liveness-api.fly.dev
VOICE_LIVENESS_API_KEY=your-api-key
```

## Scaling

### Horizontal Scaling

```bash
# Scale to multiple machines
fly scale count 3

# Scale by region
fly scale count 2 --region ord
fly scale count 2 --region lax
```

### Vertical Scaling

```bash
# Increase memory
fly scale memory 8192

# Increase CPU
fly scale vm shared-cpu-4x
```

### GPU Machines (Beta)

For faster inference with GPU:

```bash
# Request GPU access first
fly orgs gpu --enable

# Update fly.toml
[[vm]]
  gpu_kind = "a10"
  memory_mb = 16384
```

## Persistent Storage (Optional)

For caching models:

```bash
# Create volume
fly volumes create models_cache --size 10 --region ord

# Mount in fly.toml
[mounts]
  source = "models_cache"
  destination = "/models"
```

## Monitoring

### Fly Dashboard

Access at https://fly.io/dashboard

### Prometheus Metrics

```bash
# Enable metrics
fly metrics
```

### Sentry Integration

```bash
fly secrets set SENTRY_DSN="https://..."
```

## Troubleshooting

### Out of Memory

```bash
# Increase memory
fly scale memory 8192

# Or use smaller model
fly secrets set USE_SMALL_MODEL="true"
```

### Slow Cold Starts

```bash
# Keep at least 1 machine running
fly scale count 1 --min-machines-running 1
```

### Database Connection Issues

```bash
# Check connection
fly postgres connect -a voice-liveness-db

# View connection string
fly postgres config show -a voice-liveness-db
```

### Model Download Failures

Pre-download models in Dockerfile:

```dockerfile
RUN python -c "from transformers import WavLMModel; WavLMModel.from_pretrained('microsoft/wavlm-base-plus')"
```

## Production Checklist

- [ ] SSL/TLS enabled (automatic with Fly)
- [ ] Database backups configured
- [ ] Secrets set (not in fly.toml)
- [ ] Health checks passing
- [ ] Monitoring/alerting set up
- [ ] Rate limiting configured
- [ ] CORS origins restricted
- [ ] Auto-scaling configured
- [ ] Multi-region deployment (optional)

## Cost Estimation

| Resource | Specification | ~Monthly Cost |
|----------|--------------|---------------|
| VM (shared-cpu-2x) | 2 vCPU, 4GB RAM | $30 |
| Postgres | 1GB RAM, 10GB disk | $15 |
| Bandwidth | 100GB | $0 (included) |
| **Total** | | **~$45/month** |

With GPU (a10):
| Resource | Specification | ~Monthly Cost |
|----------|--------------|---------------|
| VM (GPU) | 4 vCPU, 16GB RAM, A10 | $150+ |

## Next Steps

1. Set up CI/CD with GitHub Actions
2. Configure custom domain
3. Add Sentry for error tracking
4. Set up Datadog/Prometheus monitoring
5. Implement blue-green deployments
