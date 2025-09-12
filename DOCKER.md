# Docker Deployment Guide

This guide provides comprehensive instructions for building and running the Scavenger Hunt Game Server using Docker.

## 📋 Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose 2.0+ (optional, for full stack deployment)
- 2GB of free disk space for images
- Port 3000 available (or configure alternative)

## 🏗️ Build Architecture

The application uses a multi-stage Docker build pattern with three stages:

1. **Builder Stage**: Compiles TypeScript to JavaScript
2. **Dependencies Stage**: Installs production-only dependencies
3. **Runtime Stage**: Minimal production image with Node.js 20 Alpine

### Image Size Optimization

- Base image: `node:20-alpine` (lightweight Linux distribution)
- Multi-stage build reduces final image size by ~70%
- Production dependencies only (no dev tools)
- Non-root user for security
- Proper signal handling with `dumb-init`

## 🚀 Quick Start

### Option 1: Using Wrapper Scripts (Recommended)

```bash
# For a complete setup with database (first time or after issues)
./docker-setup

# Build Docker image
./docker-build

# Run container (simple)
./docker-run

# Or run scripts directly from package directory
./package/docker-reset-and-run.sh
./package/docker-run-with-db.sh
./package/docker-build.sh
```

### Option 2: Using Docker Commands

```bash
# Build the image
docker build -f package/Dockerfile -t scavenger-hunt-server:latest .

# Run with environment variables
docker run -d \
  --name scavenger-hunt-app \
  -p 3000:3000 \
  --env-file .env \
  scavenger-hunt-server:latest
```

### Option 3: Using Docker Compose (Full Stack)

```bash
# Start database and application
docker-compose -f package/docker-compose.full.yml up -d

# Or start database only
docker-compose up -d postgres
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```env
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
DB_HOST=localhost  # Use 'host.docker.internal' in Docker
DB_PORT=5432
DB_NAME=scavenger_hunt
DB_USER=scavenger_hunt
DB_PASSWORD=scavenger_hunt

# Authentication
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION=24h
```

### Port Configuration

Default port mapping: `3000:3000` (host:container)

To use a different host port:
```bash
# Using docker run
docker run -p 8080:3000 scavenger-hunt-server:latest

# Using environment variable with wrapper
PORT=8080 ./docker-run

# Using environment variable with package script
PORT=8080 ./package/docker-run.sh
```

## 📦 Build Options

### Development Build

Build with development dependencies included:
```bash
docker build -f package/Dockerfile --target builder -t scavenger-hunt-dev:latest .
```

### Production Build with Custom Tag

```bash
./docker-build v1.0.0 runtime
# Or directly from package directory
./package/docker-build.sh v1.0.0 runtime
# Or manually
docker build -f package/Dockerfile --target runtime -t scavenger-hunt-server:v1.0.0 .
```

### Build with Cache

Leverage Docker build cache for faster rebuilds:
```bash
docker build \
  --file package/Dockerfile \
  --cache-from scavenger-hunt-server:latest \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -t scavenger-hunt-server:latest .
```

## 🗄️ Database Setup

### Using Docker Compose

The `package/docker-compose.full.yml` includes PostgreSQL:

```bash
# Start only the database
docker-compose up -d postgres

# Start full stack
docker-compose -f package/docker-compose.full.yml up -d
```

### Connecting to External Database

For external PostgreSQL, update your `.env`:
```env
DB_HOST=your-database-host.com
DB_PORT=5432
DB_NAME=your_database
DB_USER=your_user
DB_PASSWORD=your_password
```

### Running Migrations

```bash
# Generate migrations locally first
npm run db:generate

# Then run with database setup using wrapper
./docker-setup

# Or use the package script directly
./package/docker-reset-and-run.sh
```

## 🏥 Health Checks

The container includes built-in health checks:

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' scavenger-hunt-app

# View health check logs
docker inspect --format='{{json .State.Health}}' scavenger-hunt-app | jq
```

Health check endpoint: `GET /health`
- Interval: 30 seconds
- Timeout: 3 seconds
- Retries: 3

## 📊 Monitoring & Logs

### View Logs

```bash
# Follow logs in real-time
docker logs -f scavenger-hunt-app

# Last 100 lines
docker logs --tail 100 scavenger-hunt-app

# Logs since specific time
docker logs --since 2h scavenger-hunt-app
```

### Container Statistics

```bash
# Real-time stats
docker stats scavenger-hunt-app

# One-time snapshot
docker stats --no-stream scavenger-hunt-app
```

## 🛠️ Troubleshooting

### Container Won't Start

1. Check logs: `docker logs scavenger-hunt-app`
2. Verify environment variables: `docker exec scavenger-hunt-app env`
3. Test database connection: `docker exec scavenger-hunt-app nc -zv postgres 5432`
4. If migrations are missing: Run `npm run db:generate` then restart with `./docker-setup`
5. For a complete reset: Use `./docker-setup` or `./package/docker-reset-and-run.sh`

### Database Connection Issues

The scripts automatically handle `host.docker.internal` on Linux by adding the host gateway.

If running manually on Linux:
```bash
# Add host gateway
docker run --add-host=host.docker.internal:host-gateway ...
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Use different port
PORT=8080 ./docker-run.sh
```

### Permission Errors

The container runs as non-root user (UID 1001). Ensure volume permissions:
```bash
# Fix permissions for mounted volumes
docker exec -u 0 scavenger-hunt-app chown -R nodejs:nodejs /app
```

## 🔒 Security Best Practices

1. **Non-root User**: Container runs as `nodejs` user (UID 1001)
2. **Minimal Base Image**: Alpine Linux reduces attack surface
3. **No Shell by Default**: Uses `dumb-init` for PID 1
4. **Secret Management**: Never hardcode secrets in Dockerfile
5. **Network Isolation**: Use Docker networks for service communication

### Security Scanning

```bash
# Scan for vulnerabilities
docker scan scavenger-hunt-server:latest

# Using Trivy
trivy image scavenger-hunt-server:latest
```

## 🚢 Production Deployment

### Docker Swarm

```bash
# Deploy as service
docker service create \
  --name scavenger-hunt \
  --replicas 3 \
  --publish 3000:3000 \
  --env-file .env \
  scavenger-hunt-server:latest
```

### Kubernetes

Create a deployment manifest:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: scavenger-hunt-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: scavenger-hunt
  template:
    metadata:
      labels:
        app: scavenger-hunt
    spec:
      containers:
      - name: app
        image: scavenger-hunt-server:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
```

### Cloud Platforms

**AWS ECS/Fargate:**
```bash
# Push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI
docker tag scavenger-hunt-server:latest $ECR_URI/scavenger-hunt-server:latest
docker push $ECR_URI/scavenger-hunt-server:latest
```

**Google Cloud Run:**
```bash
# Push to GCR
docker tag scavenger-hunt-server:latest gcr.io/$PROJECT_ID/scavenger-hunt-server
docker push gcr.io/$PROJECT_ID/scavenger-hunt-server
gcloud run deploy --image gcr.io/$PROJECT_ID/scavenger-hunt-server
```

**Azure Container Instances:**
```bash
# Push to ACR
az acr build --registry $ACR_NAME --image scavenger-hunt-server:latest .
az container create --resource-group $RG --name scavenger-hunt --image $ACR_NAME.azurecr.io/scavenger-hunt-server:latest
```

## 🧹 Cleanup

```bash
# Stop and remove container
docker stop scavenger-hunt-app
docker rm scavenger-hunt-app

# Remove image
docker rmi scavenger-hunt-server:latest

```bash
# Clean up everything (including volumes)
docker-compose -f package/docker-compose.full.yml down -v

# Remove all unused images and containers
docker system prune -a
```

## 📝 Additional Notes

### Volume Mounts

Required volume mounts:
```bash
# Mount migrations (required for production mode)
docker run -v $(pwd)/drizzle:/app/drizzle:ro scavenger-hunt-server:latest

# For development with hot reload
docker run -v $(pwd)/src:/app/src:ro scavenger-hunt-server:latest
```

### Custom Commands

Run different commands in the container:
```bash
# Run migrations
docker run --rm scavenger-hunt-server:latest npm run db:migrate

# Run tests
docker run --rm scavenger-hunt-server:latest npm test

# Interactive shell
docker run -it --rm scavenger-hunt-server:latest sh
```

### Multi-Architecture Builds

Build for multiple platforms:
```bash
docker buildx build \
  --file package/Dockerfile \
  --platform linux/amd64,linux/arm64 \
  --tag scavenger-hunt-server:latest \
  --push .
```

## 🎮 Default Credentials

After running the setup scripts, the following default admin user is created:
- **Username**: `admin@local.domain`
- **Password**: `admin123`
- **Role**: `game.admin`

## 📚 Resources

- [Docker Documentation](https://docs.docker.com/)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
- [Alpine Linux](https://alpinelinux.org/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)