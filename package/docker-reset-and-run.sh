#!/bin/bash

# Docker Reset and Run Script for Scavenger Hunt Game Server
# This script performs a full reset of the database and runs the application
# Can be run from either the package directory or the project root

set -e

# Determine the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(basename "$SCRIPT_DIR")" == "package" ]]; then
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
else
    PROJECT_ROOT="$SCRIPT_DIR"
fi

# Change to project root for proper context
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="scavenger-hunt-server"
IMAGE_TAG="${1:-latest}"
CONTAINER_NAME="scavenger-hunt-app"
PORT="${PORT:-3000}"
ENV_FILE=".env"

echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}  Scavenger Hunt Game Server - Full Reset & Run  ${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Warning message
echo -e "${YELLOW}⚠️  WARNING: This will delete all database data!${NC}"
echo -e "${YELLOW}Press Ctrl+C to cancel or Enter to continue...${NC}"
read -r

# Step 1: Stop all related containers
echo -e "${GREEN}Step 1: Stopping all containers...${NC}"
docker-compose down -v 2>/dev/null || true
docker stop scavenger-hunt-app 2>/dev/null || true
docker rm scavenger-hunt-app 2>/dev/null || true
docker stop scavenger-hunt-postgres 2>/dev/null || true
docker rm scavenger-hunt-postgres 2>/dev/null || true
echo -e "${GREEN}✅ All containers stopped and removed${NC}"

# Step 2: Remove old migrations
echo -e "${GREEN}Step 2: Cleaning up old migrations...${NC}"
if [ -d "drizzle" ]; then
    rm -rf drizzle
    echo -e "${GREEN}✅ Old migrations removed${NC}"
else
    echo -e "${BLUE}No migrations to remove${NC}"
fi

# Step 3: Start fresh PostgreSQL
echo -e "${GREEN}Step 3: Starting fresh PostgreSQL database...${NC}"
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo -e "${BLUE}Waiting for PostgreSQL to be ready...${NC}"
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U scavenger_hunt -d scavenger_hunt &> /dev/null; then
        echo -e "${GREEN}✅ PostgreSQL is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ PostgreSQL failed to start${NC}"
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo ""

# Step 4: Generate fresh migrations
echo -e "${GREEN}Step 4: Generating fresh database migrations...${NC}"
if command -v npm &> /dev/null; then
    npm run db:generate
else
    echo -e "${YELLOW}npm not found locally. Using Docker to generate migrations...${NC}"
    docker run --rm \
        -v "$(pwd)":/app \
        -w /app \
        --env-file .env \
        node:20-alpine \
        sh -c "npm ci && npm run db:generate"
fi

if [ -d "drizzle" ] && [ -f "drizzle/meta/_journal.json" ]; then
    echo -e "${GREEN}✅ Migrations generated successfully!${NC}"
    # Count migration files
    migration_count=$(find drizzle -name "*.sql" | wc -l)
    echo -e "${BLUE}Generated ${migration_count} migration file(s)${NC}"
else
    echo -e "${RED}❌ Failed to generate migrations${NC}"
    exit 1
fi

# Step 5: Build Docker image if needed
echo -e "${GREEN}Step 5: Checking Docker image...${NC}"
if ! docker image inspect "${IMAGE_NAME}:${IMAGE_TAG}" &> /dev/null; then
    echo -e "${YELLOW}Building Docker image...${NC}"
    ./package/docker-build.sh "${IMAGE_TAG}"
else
    echo -e "${GREEN}✅ Docker image exists${NC}"
fi

# Step 6: Run the application container
echo -e "${GREEN}Step 6: Starting application container...${NC}"
docker run \
    --name "${CONTAINER_NAME}" \
    --detach \
    --restart unless-stopped \
    --publish "${PORT}:3000" \
    --env-file "${ENV_FILE}" \
    --env NODE_ENV="${NODE_ENV:-production}" \
    --env PORT=3000 \
    --env DB_HOST="host.docker.internal" \
    --env DB_PORT="${DB_PORT:-5432}" \
    --env DB_NAME="${DB_NAME:-scavenger_hunt}" \
    --env DB_USER="${DB_USER:-scavenger_hunt}" \
    --env DB_PASSWORD="${DB_PASSWORD:-scavenger_hunt}" \
    --env JWT_SECRET="${JWT_SECRET:-change-me-in-production}" \
    --env JWT_EXPIRATION="${JWT_EXPIRATION:-24h}" \
    --env LOG_LEVEL="${LOG_LEVEL:-info}" \
    --volume "$(pwd)/drizzle:/app/drizzle:ro" \
    --add-host=host.docker.internal:host-gateway \
    "${IMAGE_NAME}:${IMAGE_TAG}"

# Step 7: Verify application is running
echo -e "${GREEN}Step 7: Verifying application...${NC}"
echo -e "${BLUE}Waiting for application to start...${NC}"
sleep 5

# Check container status
if [ "$(docker ps -q -f name=${CONTAINER_NAME})" ]; then
    # Check logs for errors
    if docker logs "${CONTAINER_NAME}" 2>&1 | grep -q "Server running on port"; then
        echo -e "${GREEN}✅ Application started successfully!${NC}"

        # Test health endpoint
        echo -e "${BLUE}Testing health endpoint...${NC}"
        for i in {1..10}; do
            if curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT}/health | grep -q "200"; then
                echo -e "${GREEN}✅ Health check passed!${NC}"
                break
            fi
            if [ $i -eq 10 ]; then
                echo -e "${YELLOW}⚠️  Health check is taking longer than expected${NC}"
            fi
            sleep 1
        done

        echo ""
        echo -e "${GREEN}==================================================${NC}"
        echo -e "${GREEN}        🎉 Setup Complete! 🎉                    ${NC}"
        echo -e "${GREEN}==================================================${NC}"
        echo ""
        echo -e "${GREEN}Application URLs:${NC}"
        echo -e "  Health:   ${YELLOW}http://localhost:${PORT}/health${NC}"
        echo -e "  Ready:    ${YELLOW}http://localhost:${PORT}/ready${NC}"
        echo -e "  Auth:     ${YELLOW}http://localhost:${PORT}/auth/login${NC}"
        echo -e "  Register: ${YELLOW}http://localhost:${PORT}/hunt/auth/register${NC}"
        echo -e "  API:      ${YELLOW}http://localhost:${PORT}/hunt${NC}"
        echo ""
        echo -e "${GREEN}Database:${NC}"
        echo -e "  Host: localhost"
        echo -e "  Port: 5432"
        echo -e "  Name: scavenger_hunt"
        echo -e "  User: scavenger_hunt"
        echo ""
        echo -e "${GREEN}Default Admin User:${NC}"
        echo -e "  Username: admin"
        echo -e "  Password: admin123"
        echo ""
        echo -e "${GREEN}Useful commands:${NC}"
        echo -e "  View logs:          ${YELLOW}docker logs -f ${CONTAINER_NAME}${NC}"
        echo -e "  Stop everything:    ${YELLOW}docker-compose down${NC}"
        echo -e "  Database shell:     ${YELLOW}docker exec -it scavenger-hunt-postgres psql -U scavenger_hunt${NC}"
        echo -e "  App shell:          ${YELLOW}docker exec -it ${CONTAINER_NAME} sh${NC}"
        echo -e "  Container stats:    ${YELLOW}docker stats ${CONTAINER_NAME}${NC}"
        echo ""
    else
        echo -e "${RED}❌ Application failed to start properly${NC}"
        echo -e "${YELLOW}Checking logs...${NC}"
        docker logs --tail 50 "${CONTAINER_NAME}"
        exit 1
    fi
else
    echo -e "${RED}❌ Container is not running${NC}"
    echo -e "${YELLOW}Checking logs...${NC}"
    docker logs --tail 50 "${CONTAINER_NAME}" 2>/dev/null || echo "No logs available"
    exit 1
fi
