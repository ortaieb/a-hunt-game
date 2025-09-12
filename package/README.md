# Docker Package Directory

This directory contains all Docker-related files and scripts for the Scavenger Hunt Game Server.

## 📁 Directory Structure

```
package/
├── README.md                    # This file
├── Dockerfile                   # Multi-stage production Dockerfile
├── Dockerfile.dev              # Development Dockerfile with full tooling
├── docker-compose.full.yml     # Complete stack (PostgreSQL + Application)
├── docker-build.sh            # Docker image build script
├── docker-run.sh              # Simple container run script
├── docker-run-with-db.sh      # Run with database setup
└── docker-reset-and-run.sh    # Full reset and setup script
```

## 🚀 Usage

### From Project Root (Recommended)

Use the wrapper scripts in the project root:

```bash
# Build Docker image
./docker-build [tag] [target]

# Run container (simple)
./docker-run [tag]

# Complete setup with database
./docker-setup
```

### From Package Directory

Run scripts directly from this directory:

```bash
# Build Docker image
./docker-build.sh [tag] [target]

# Run with database setup
./docker-run-with-db.sh [tag]

# Full reset and setup
./docker-reset-and-run.sh [tag]
```

## 📦 Docker Images

### Production Image (`Dockerfile`)
- **Base**: `node:20-alpine`
- **Size**: ~186MB
- **Security**: Non-root user, minimal dependencies
- **Target**: `runtime` (default)

### Development Image (`Dockerfile.dev`)
- **Base**: `node:20-alpine`
- **Includes**: All dev dependencies, testing tools, PostgreSQL client
- **Purpose**: Development, testing, migrations

## 🛠️ Scripts Overview

### `docker-build.sh`
- Builds optimized production Docker image
- Supports build caching for faster rebuilds
- Works from both package directory and project root

### `docker-run.sh`
- Runs a simple container instance
- Automatically builds image if missing
- Basic environment variable support

### `docker-run-with-db.sh`
- Ensures PostgreSQL is running
- Generates database migrations if needed
- Mounts migrations to container
- Full database connectivity setup

### `docker-reset-and-run.sh` (Recommended for first run)
- Complete environment reset
- Fresh PostgreSQL database
- Regenerates migrations
- Creates default admin user
- Full verification and health checks

## 🔧 Configuration

### Environment Variables

The scripts use the following environment variables (with defaults):

```bash
NODE_ENV=production
PORT=3000
DB_HOST=host.docker.internal
DB_PORT=5432
DB_NAME=scavenger_hunt
DB_USER=scavenger_hunt
DB_PASSWORD=scavenger_hunt
JWT_SECRET=change-me-in-production
JWT_EXPIRATION=24h
LOG_LEVEL=info
```

### Docker Compose

The `docker-compose.full.yml` provides:
- PostgreSQL 15 database
- Application container with health checks
- Automatic service dependencies
- Volume persistence for database data
- Network isolation

## 🔍 Troubleshooting

### Common Issues

1. **Migration Errors**
   ```bash
   # Generate fresh migrations
   npm run db:generate
   
   # Use reset script for clean start
   ./docker-reset-and-run.sh
   ```

2. **Port Conflicts**
   ```bash
   # Use different port
   PORT=8080 ./docker-run-with-db.sh
   ```

3. **Database Connection**
   ```bash
   # Check database is running
   docker ps | grep postgres
   
   # Check connectivity
   docker exec scavenger-hunt-app nc -zv host.docker.internal 5432
   ```

### Logs and Debugging

```bash
# View application logs
docker logs -f scavenger-hunt-app

# View all service logs
docker-compose logs -f

# Shell access to container
docker exec -it scavenger-hunt-app sh

# Database shell
docker exec -it scavenger-hunt-postgres psql -U scavenger_hunt
```

## 🎯 Default Setup

After running the setup scripts:

- **Application**: http://localhost:3000
- **Admin User**: `admin@local.domain` / `admin123`
- **Database**: `postgresql://scavenger_hunt:scavenger_hunt@localhost:5432/scavenger_hunt`

## 📚 Additional Resources

- [Docker Documentation](../DOCKER.md) - Comprehensive Docker guide
- [Project README](../README.md) - Main project documentation
- [Operational Guide](../operational-guide.md) - Development and deployment guide