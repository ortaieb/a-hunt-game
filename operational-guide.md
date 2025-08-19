# Operational Guide - Scavenger Hunt Game Server

This guide provides instructions for formatting, linting, testing, and building the Scavenger Hunt Game Server application.

## Prerequisites

- Node.js 18.x or 20.x
- npm (comes with Node.js)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

## Development

### Running the Server

Start the development server with hot reloading:
```bash
npm run dev
```

The server will start on the port specified in your `.env` file or default to port 3000.

### Building for Production

Compile TypeScript to JavaScript:
```bash
npm run build
```

Run the compiled application:
```bash
npm start
```

## Code Quality

### Linting

Check for code style and potential issues:
```bash
npm run lint
```

Auto-fix linting issues where possible:
```bash
npm run lint:fix
```

### Type Checking

Verify TypeScript types without building:
```bash
npm run typecheck
```

## Testing

### Run All Tests

Execute the complete test suite:
```bash
npm test
```

### Watch Mode

Run tests in watch mode for development:
```bash
npm run test:watch
```

### Coverage Report

Generate test coverage report:
```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory.

## Configuration

### Environment Variables

The application supports the following environment variables:

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (default: development)

### Command Line Arguments

Override environment variables using command line arguments:

```bash
# Set custom port
npm run dev -- --port 8080

# Set environment
npm run dev -- --node-env production
```

When running the built application:
```bash
node dist/index.js --port 8080 --node-env production
```

## API Endpoints

### Health Check
- **GET** `/health`
- **Response**: 200 OK with timestamp
- **Purpose**: Verify server is running

### Ready Check
- **GET** `/ready`
- **Response**: 400 Bad Request
- **Purpose**: Indicates service readiness (currently returns not ready)

## Docker Support

### Environment Variables in Docker

When running in Docker, environment variables can be passed via:

1. Docker run command:
   ```bash
   docker run -e PORT=8080 -e NODE_ENV=production your-image
   ```

2. Docker Compose:
   ```yaml
   environment:
     - PORT=8080
     - NODE_ENV=production
   ```

## Continuous Integration

The project includes GitHub Actions workflow that:

- Runs on pull requests and pushes to main branch
- Tests against Node.js 18.x and 20.x
- Performs linting, type checking, testing, and building
- Generates coverage reports

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the PORT environment variable or use `--port` argument
2. **TypeScript errors**: Run `npm run typecheck` to see detailed type errors
3. **Test failures**: Run tests with `npm run test:watch` for detailed debugging

### Debug Mode

Enable debug logging by setting NODE_ENV to 'development':
```bash
NODE_ENV=development npm run dev
```

## Project Structure

```
src/
├── app.ts          # Express application setup
├── config.ts       # Configuration management
├── index.ts        # Server entry point
├── app.test.ts     # Application tests
└── config.test.ts  # Configuration tests
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm start` | Run compiled application |
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Check code style and issues |
| `npm run lint:fix` | Auto-fix linting issues |
| `npm run typecheck` | Verify TypeScript types |