# Scavenger Hunt Game Server

A TypeScript-based backend server for the Scavenger Hunt Game application.

## Quick Start

For detailed instructions on formatting, linting, testing, and building the application, please refer to the [Operational Guide](./operational-guide.md).

## Features

- REST API server built with Express and TypeScript
- Health and readiness endpoints
- Environment variable configuration with CLI override support
- Comprehensive test coverage
- GitHub Actions CI/CD pipeline
- ESLint and TypeScript strict mode for code quality

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

For complete development and operational instructions, see the [Operational Guide](./operational-guide.md).