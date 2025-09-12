#!/bin/bash

# Docker Run Script for Scavenger Hunt Game Server
# This script runs the Docker container with proper configuration
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

echo -e "${GREEN}Running Scavenger Hunt Game Server Docker Container${NC}"
echo -e "Image: ${YELLOW}${IMAGE_NAME}:${IMAGE_TAG}${NC}"
echo -e "Container: ${YELLOW}${CONTAINER_NAME}${NC}"
echo ""

# Check if image exists
if ! docker image inspect "${IMAGE_NAME}:${IMAGE_TAG}" &> /dev/null; then
    echo -e "${YELLOW}Image ${IMAGE_NAME}:${IMAGE_TAG} not found. Building...${NC}"
    ./package/docker-build.sh "${IMAGE_TAG}"
fi

# Check if container is already running
if [ "$(docker ps -q -f name=${CONTAINER_NAME})" ]; then
    echo -e "${YELLOW}Container ${CONTAINER_NAME} is already running${NC}"
    echo -e "${BLUE}Stopping existing container...${NC}"
    docker stop "${CONTAINER_NAME}"
    docker rm "${CONTAINER_NAME}"
fi

# Check for .env file
ENV_FILE_OPTS=""
if [ -f "${ENV_FILE}" ]; then
    echo -e "${GREEN}Using environment file: ${ENV_FILE}${NC}"
    ENV_FILE_OPTS="--env-file ${ENV_FILE}"
else
    echo -e "${YELLOW}Warning: ${ENV_FILE} not found. Using default environment variables${NC}"
    echo -e "${BLUE}Copy .env.example to .env and configure it for your environment${NC}"
fi

# Run the container
echo -e "${GREEN}Starting Docker container...${NC}"
docker run \
    --name "${CONTAINER_NAME}" \
    --detach \
    --restart unless-stopped \
    --publish "${PORT}:3000" \
    ${ENV_FILE_OPTS} \
    --env NODE_ENV="${NODE_ENV:-production}" \
    --env PORT=3000 \
    --env DB_HOST="${DB_HOST:-host.docker.internal}" \
    --env DB_PORT="${DB_PORT:-5432}" \
    --env DB_NAME="${DB_NAME:-scavenger_hunt}" \
    --env DB_USER="${DB_USER:-scavenger_hunt}" \
    --env DB_PASSWORD="${DB_PASSWORD:-scavenger_hunt}" \
    --env JWT_SECRET="${JWT_SECRET:-change-me-in-production}" \
    --env JWT_EXPIRATION="${JWT_EXPIRATION:-24h}" \
    --env LOG_LEVEL="${LOG_LEVEL:-info}" \
    "${IMAGE_NAME}:${IMAGE_TAG}"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Container started successfully!${NC}"
    echo ""
    echo -e "${GREEN}Container details:${NC}"
    docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo -e "${GREEN}Application is running at:${NC} ${YELLOW}http://localhost:${PORT}${NC}"
    echo ""
    echo -e "${GREEN}Useful commands:${NC}"
    echo -e "  View logs:        ${YELLOW}docker logs -f ${CONTAINER_NAME}${NC}"
    echo -e "  Stop container:   ${YELLOW}docker stop ${CONTAINER_NAME}${NC}"
    echo -e "  Remove container: ${YELLOW}docker rm ${CONTAINER_NAME}${NC}"
    echo -e "  Shell access:     ${YELLOW}docker exec -it ${CONTAINER_NAME} sh${NC}"
    echo -e "  Health status:    ${YELLOW}docker inspect --format='{{.State.Health.Status}}' ${CONTAINER_NAME}${NC}"
else
    echo -e "${RED}❌ Failed to start container${NC}"
    exit 1
fi
