#!/bin/bash

# Docker Build Script for Scavenger Hunt Game Server
# This script builds the Docker image with proper tagging and caching
# Can be run from either the package directory or the project root

set -e

# Determine the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(basename "$SCRIPT_DIR")" == "package" ]]; then
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
else
    PROJECT_ROOT="$SCRIPT_DIR"
fi

# Change to project root for Docker build context
cd "$PROJECT_ROOT"

# Set Dockerfile path relative to package directory
DOCKERFILE_PATH="package/Dockerfile"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="scavenger-hunt-server"
IMAGE_TAG="${1:-latest}"
BUILD_TARGET="${2:-runtime}"

echo -e "${GREEN}Building Scavenger Hunt Game Server Docker Image${NC}"
echo -e "Image: ${YELLOW}${IMAGE_NAME}:${IMAGE_TAG}${NC}"
echo -e "Target: ${YELLOW}${BUILD_TARGET}${NC}"
echo ""

# Check if Dockerfile exists
if [ ! -f "$DOCKERFILE_PATH" ]; then
    echo -e "${RED}Error: Dockerfile not found at $DOCKERFILE_PATH${NC}"
    exit 1
fi

# Build the image
echo -e "${GREEN}Starting Docker build...${NC}"
# Try to use cache if available, but don't fail if it doesn't exist
if docker image inspect "${IMAGE_NAME}:latest" &> /dev/null; then
    echo -e "${GREEN}Using cache from ${IMAGE_NAME}:latest${NC}"
    docker build \
        --file "$DOCKERFILE_PATH" \
        --target "${BUILD_TARGET}" \
        --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
        --tag "${IMAGE_NAME}:latest" \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --cache-from "${IMAGE_NAME}:latest" \
        .
else
    echo -e "${YELLOW}No cache available, building from scratch${NC}"
    docker build \
        --file "$DOCKERFILE_PATH" \
        --target "${BUILD_TARGET}" \
        --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
        --tag "${IMAGE_NAME}:latest" \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        .
fi

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Docker image built successfully!${NC}"
    echo -e "Image: ${YELLOW}${IMAGE_NAME}:${IMAGE_TAG}${NC}"
    echo ""
    echo -e "${GREEN}Image details:${NC}"
    docker images "${IMAGE_NAME}:${IMAGE_TAG}"
    echo ""
    echo -e "${GREEN}To run the container:${NC}"
    echo -e "  ${YELLOW}./package/docker-run.sh${NC}"
    echo -e "${GREEN}Or with docker-compose:${NC}"
    echo -e "  ${YELLOW}docker-compose -f package/docker-compose.full.yml up${NC}"
else
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi
