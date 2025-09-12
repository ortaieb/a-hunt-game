#!/bin/bash

# Docker Run Script with Database Setup for Scavenger Hunt Game Server
# This script ensures the database is running and migrations are generated before starting the app
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

echo -e "${GREEN}Running Scavenger Hunt Game Server with Database Setup${NC}"
echo ""

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f "${ENV_FILE}" ]; then
    echo -e "${YELLOW}Warning: ${ENV_FILE} not found${NC}"
    echo -e "${BLUE}Creating .env from example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}.env file created. Please edit it with your configuration.${NC}"
    else
        echo -e "${RED}Error: .env.example not found. Creating minimal .env file...${NC}"
        cat > .env << EOF
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=scavenger_hunt
DB_USER=scavenger_hunt
DB_PASSWORD=scavenger_hunt
JWT_SECRET=change-me-in-production
JWT_EXPIRATION=24h
LOG_LEVEL=info
EOF
        echo -e "${GREEN}Minimal .env file created.${NC}"
    fi
fi

# Step 1: Ensure PostgreSQL is running
echo -e "${GREEN}Step 1: Checking PostgreSQL database...${NC}"
if [ "$(docker ps -q -f name=scavenger-hunt-postgres)" ]; then
    echo -e "${GREEN}PostgreSQL is already running${NC}"
else
    echo -e "${YELLOW}Starting PostgreSQL...${NC}"
    docker-compose up -d postgres

    # Wait for PostgreSQL to be ready
    echo -e "${BLUE}Waiting for PostgreSQL to be ready...${NC}"
    for i in {1..30}; do
        if docker exec scavenger-hunt-postgres pg_isready -U scavenger_hunt -d scavenger_hunt &> /dev/null; then
            echo -e "${GREEN}PostgreSQL is ready!${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
    echo ""
fi

# Step 2: Generate migrations if they don't exist
echo -e "${GREEN}Step 2: Checking for database migrations...${NC}"
if [ ! -d "drizzle" ] || [ ! -f "drizzle/meta/_journal.json" ]; then
    echo -e "${YELLOW}Migrations not found. Generating...${NC}"

    # Check if npm is available locally
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

    if [ -d "drizzle" ]; then
        echo -e "${GREEN}Migrations generated successfully!${NC}"
    else
        echo -e "${RED}Failed to generate migrations${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}Migrations already exist${NC}"
fi

# Step 3: Build the Docker image if needed
echo -e "${GREEN}Step 3: Checking Docker image...${NC}"
if ! docker image inspect "${IMAGE_NAME}:${IMAGE_TAG}" &> /dev/null; then
    echo -e "${YELLOW}Image ${IMAGE_NAME}:${IMAGE_TAG} not found. Building...${NC}"
    ./package/docker-build.sh "${IMAGE_TAG}"
fi

# Step 4: Stop existing container if running
if [ "$(docker ps -q -f name=${CONTAINER_NAME})" ]; then
    echo -e "${YELLOW}Stopping existing container...${NC}"
    docker stop "${CONTAINER_NAME}"
    docker rm "${CONTAINER_NAME}"
fi

# Step 5: Run the application container with mounted migrations
echo -e "${GREEN}Step 4: Starting application container...${NC}"
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

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Application started successfully!${NC}"
    echo ""

    # Wait a moment for the container to start
    sleep 2

    # Check if the container is still running
    if [ "$(docker ps -q -f name=${CONTAINER_NAME})" ]; then
        echo -e "${GREEN}Container status:${NC}"
        docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""

        # Test the health endpoint
        echo -e "${GREEN}Testing health endpoint...${NC}"
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT}/health | grep -q "200"; then
            echo -e "${GREEN}✅ Health check passed!${NC}"
        else
            echo -e "${YELLOW}⚠️  Health check failed. Check logs for details.${NC}"
        fi

        echo ""
        echo -e "${GREEN}Application URLs:${NC}"
        echo -e "  Health:  ${YELLOW}http://localhost:${PORT}/health${NC}"
        echo -e "  Ready:   ${YELLOW}http://localhost:${PORT}/ready${NC}"
        echo -e "  API:     ${YELLOW}http://localhost:${PORT}/hunt${NC}"
        echo ""
        echo -e "${GREEN}Useful commands:${NC}"
        echo -e "  View logs:        ${YELLOW}docker logs -f ${CONTAINER_NAME}${NC}"
        echo -e "  Stop services:    ${YELLOW}docker-compose down${NC}"
        echo -e "  Database shell:   ${YELLOW}docker exec -it scavenger-hunt-postgres psql -U scavenger_hunt${NC}"
        echo -e "  App shell:        ${YELLOW}docker exec -it ${CONTAINER_NAME} sh${NC}"
    else
        echo -e "${RED}❌ Container stopped unexpectedly${NC}"
        echo -e "${YELLOW}Checking logs...${NC}"
        docker logs --tail 50 "${CONTAINER_NAME}"
        exit 1
    fi
else
    echo -e "${RED}❌ Failed to start container${NC}"
    exit 1
fi
