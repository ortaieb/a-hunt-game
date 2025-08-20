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

---

## Appendix: User Management Setup

This appendix provides setup instructions for the user management system with automated database management using Drizzle ORM.

### A1. Database Setup with Docker PostgreSQL

The user management system requires a PostgreSQL database. Follow these steps to set up PostgreSQL using Docker:

#### A1.1 Start PostgreSQL Container

```bash
# Pull and start PostgreSQL container
docker run --name scavenger-hunt-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=scavenger_hunt \
  -p 5432:5432 \
  -d postgres:15

# Verify container is running
docker ps
```

#### A1.2 Alternative: Using Docker Compose

Create a `docker-compose.yml` file in your project root:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    container_name: scavenger-hunt-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: scavenger_hunt
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

Start with Docker Compose:
```bash
docker-compose up -d postgres
```

#### A1.3 Connect to PostgreSQL

Test the database connection:
```bash
# Using psql (if installed locally)
psql -h localhost -p 5432 -U postgres -d scavenger_hunt

# Using Docker exec
docker exec -it scavenger-hunt-postgres psql -U postgres -d scavenger_hunt
```

### A2. Automated Database Management with Drizzle ORM

The application now uses **Drizzle ORM** for automated database schema management, eliminating all manual setup steps:

#### A2.1 Automatic Schema Management

**Development Mode (Recommended for Development):**
- Uses `drizzle-kit push` for instant schema updates
- No migration files needed for rapid development
- Schema changes are automatically applied on startup

**Production Mode:**
- Uses traditional migrations for safety and audit trail
- Generates migration files with `npm run db:generate`
- Applies migrations automatically on startup

When you start the application, it will:
1. Connect to the PostgreSQL database using Drizzle ORM
2. Automatically detect your environment (development/production)
3. Apply schema changes using the appropriate method
4. Create the temporal `users` table with all constraints
5. Initialize the default admin user

#### A2.2 Manual Schema Verification

To verify the schema was created correctly:

```sql
-- Connect to the database
\c scavenger_hunt

-- List all tables
\dt

-- Describe the users table structure
\d users

-- Check indexes
\di

-- Verify default admin user exists
SELECT user_id, username, nickname, roles, valid_from, valid_until 
FROM users 
WHERE valid_until IS NULL;
```

Expected table structure:
```sql
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(255) NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{}',
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Unique constraint for active users
CREATE UNIQUE INDEX idx_users_username_active 
ON users (username) WHERE valid_until IS NULL;

-- Temporal query optimization
CREATE INDEX idx_users_temporal 
ON users (username, valid_from, valid_until);
```

### A3. JWT Secret Generation

The user management system requires a secure JWT secret for token signing and verification.

#### A3.1 Generate Secure JWT Secret

**Option 1: Using Node.js crypto (Recommended)**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Option 2: Using OpenSSL**
```bash
openssl rand -hex 64
```

**Option 3: Using online generator (Development only)**
Visit: https://generate-secret.vercel.app/64

#### A3.2 Update Environment Configuration

Add the generated secret to your `.env` file:

```env
# Authentication Configuration
JWT_SECRET=your-generated-64-character-hex-string-here
JWT_EXPIRES_IN=24h
```

**Important Security Notes:**
- Use a different secret for each environment (development, staging, production)
- Keep the JWT secret confidential and never commit it to version control
- Use at least 256 bits (64 hex characters) for production
- Rotate secrets periodically for enhanced security

### A4. Complete Environment Configuration

Update your `.env` file with all required configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=scavenger_hunt
DB_USER=postgres
DB_PASSWORD=postgres

# Authentication Configuration (GENERATE YOUR OWN!)
JWT_SECRET=your-generated-64-character-hex-string-here
JWT_EXPIRES_IN=24h

# Default Admin User (Environment Variables Only - Not in Config Struct)
DEFAULT_ADMIN_USERNAME=admin@local.domain
DEFAULT_ADMIN_PASSWORD=Password1!
DEFAULT_ADMIN_NICKNAME=admin
```

### A5. Starting the Application with User Management

#### A5.1 Development Mode

```bash
# Ensure PostgreSQL is running
docker ps | grep postgres

# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

The application will:
1. Connect to PostgreSQL
2. Initialize the database schema
3. Create the default admin user
4. Start the server on port 3000

#### A5.2 Verify Setup

Test the user management endpoints:

```bash
# Generate admin token (you'll need to implement a login endpoint or use the default admin)
# For now, you can generate a token manually for testing:

# Test creating a user (requires admin token)
curl -X POST http://localhost:3000/hunt/users \
  -H "Content-Type: application/json" \
  -H "user-auth-token: YOUR_ADMIN_JWT_TOKEN" \
  -d '{
    "username": "test@example.com",
    "password": "TestPassword123!",
    "nickname": "TestUser",
    "roles": ["user"]
  }'
```

### A6. Troubleshooting

#### A6.1 Common Database Issues

**Connection refused:**
```bash
# Check if PostgreSQL container is running
docker ps | grep postgres

# Check container logs
docker logs scavenger-hunt-postgres

# Restart container if needed
docker restart scavenger-hunt-postgres
```

**Permission denied:**
```bash
# Ensure database credentials match your .env file
# Check PostgreSQL logs for authentication errors
docker logs scavenger-hunt-postgres
```

#### A6.2 JWT Token Issues

**Invalid token errors:**
- Verify JWT_SECRET matches between token generation and validation
- Check token expiration (JWT_EXPIRES_IN)
- Ensure token is sent in `user-auth-token` header

#### A6.3 Admin User Issues

**Default admin not created:**
- Check application startup logs
- Verify database connection is successful
- Ensure DEFAULT_ADMIN_* environment variables are set

**Admin password forgotten:**
- Update DEFAULT_ADMIN_PASSWORD in .env
- Restart the application (it will update the admin user)

### A7. Production Considerations

#### A7.1 Database Security
- Use strong passwords for PostgreSQL
- Configure PostgreSQL with SSL/TLS
- Restrict database access to application servers only
- Regular database backups

#### A7.2 JWT Security
- Use environment-specific JWT secrets
- Implement token refresh mechanism
- Consider shorter token expiration times
- Monitor for token abuse

#### A7.3 Environment Variables
- Never commit secrets to version control
- Use secure secret management systems in production
- Rotate secrets regularly
- Implement proper access controls

### A8. Drizzle ORM Database Commands

The application now includes automated database management commands:

#### A8.1 Development Commands
```bash
# Push schema changes instantly (development mode)
npm run db:push

# Open Drizzle Studio - Visual database explorer
npm run db:studio

# Check for schema drift and issues
npm run db:check
```

#### A8.2 Production Commands
```bash
# Generate migration files for production
npm run db:generate

# Apply pending migrations
npm run db:migrate
```

#### A8.3 Schema Management Workflow

**Development Workflow:**
1. Modify schema in `src/schema/users.ts`
2. Run `npm run db:push` or restart the app
3. Schema is automatically updated in database

**Production Workflow:**
1. Modify schema in `src/schema/users.ts`
2. Run `npm run db:generate` to create migration
3. Commit migration files to version control
4. Deploy application (migrations run automatically)

### A9. Benefits of Drizzle Integration

✅ **Zero Manual Steps**: Database schema is managed automatically  
✅ **Type Safety**: Full TypeScript integration with compile-time query validation  
✅ **Development Speed**: Instant schema updates with `db:push`  
✅ **Production Safety**: Traditional migrations for production deployments  
✅ **SQL-like Syntax**: Similar to sqlx with TypeScript benefits  
✅ **Performance**: Lightweight ORM with minimal overhead  
✅ **Temporal Tables**: Full support for temporal database patterns  

### A10. Quick Setup Checklist

- [ ] PostgreSQL container running on port 5432
- [ ] Database `scavenger_hunt` created
- [ ] Strong JWT secret generated (64+ characters)
- [ ] `.env` file configured with all required variables
- [ ] Dependencies installed (`npm install`)
- [ ] Application starts without errors (`npm run dev`)
- [ ] Drizzle automatically creates/updates schema
- [ ] Default admin user created successfully
- [ ] API endpoints accessible at http://localhost:3000/hunt/users
- [ ] Optional: Access Drizzle Studio at `npm run db:studio`