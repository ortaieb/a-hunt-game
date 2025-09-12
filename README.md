# Scavenger Hunt Game Server

A TypeScript-based backend server for the Scavenger Hunt Game application.

## Quick Start

### Docker Deployment (Recommended for Testing)

```bash
# Complete setup with database (first time)
./docker-setup

# Or build and run separately
./docker-build
./docker-run

# Using package scripts directly
./package/docker-reset-and-run.sh
./package/docker-build.sh

# Or use Docker Compose for full stack (with PostgreSQL)
docker-compose -f package/docker-compose.full.yml up -d
```

For detailed Docker deployment instructions, see the [Docker Guide](./DOCKER.md).

For detailed instructions on formatting, linting, testing, and building the application, please refer to the [Operational Guide](./operational-guide.md).

## Features

- REST API server built with Express and TypeScript
- Health and readiness endpoints
- Environment variable configuration with CLI override support
- Comprehensive test coverage
- GitHub Actions CI/CD pipeline
- ESLint and TypeScript strict mode for code quality
- Docker support with multi-stage builds for optimized production images
- PostgreSQL database with Drizzle ORM

## API Endpoints

- `GET /health` - Returns 200 OK with server status
- `GET /ready` - Returns 400 Bad Request (service not ready indicator)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Docker Deployment

The application includes a production-ready Docker setup with:
- Multi-stage build for minimal image size (~150MB)
- Non-root user for security
- Health checks and proper signal handling
- Docker Compose for full stack deployment

```bash
# Quick start with Docker (wrapper scripts)
./docker-build
./docker-run

# Or quick start with complete setup
./docker-setup

# Or using package scripts directly
./package/docker-build.sh
./package/docker-run.sh

# Or manual Docker commands
docker build -f package/Dockerfile -t scavenger-hunt-server .
docker run -p 3000:3000 --env-file .env scavenger-hunt-server
```

See [DOCKER.md](./DOCKER.md) for comprehensive Docker deployment documentation.

For complete development and operational instructions, see the [Operational Guide](./operational-guide.md).