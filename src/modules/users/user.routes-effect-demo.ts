// src/modules/users/user.routes-effect-demo.ts
// Demonstration of Effect-based REST endpoints integration
// This shows how to integrate Effect patterns with existing Express routes

import { Effect, Layer } from 'effect';
import { Router, Request, Response } from 'express';
import {
  listUsersEffect,
  getUserEffect,
  createUserEffect,
  updateUserEffect,
  deleteUserEffect,
  runEffectRoute,
  EffectHttpError,
  AuthEffectServiceTag,
  AuthEffectService,
  EffectUnauthorizedError,
  EffectForbiddenError,
} from './user.routes-effect-simple';
import {
  UserServiceEffectTag,
  UserServiceEffectLive,
} from './user.service-effect';
import { DatabaseLive } from '../../shared/database/effect-database';

/**
 * Implementation of AuthEffectService for production use
 * This would integrate with your existing JWT authentication
 */
export class ProductionAuthService implements AuthEffectService {
  authenticateToken = (token: string) =>
    Effect.gen(function* () {
      if (!token) {
        return yield* Effect.fail(new EffectUnauthorizedError('No token provided'));
      }

      // Here you would verify the JWT token
      // For demo purposes, we'll simulate token validation
      try {
        // Simulate JWT verification
        const payload = this.verifyJWT(token);
        return {
          username: payload.upn,
          roles: payload.groups,
        };
      } catch (error) {
        return yield* Effect.fail(new EffectUnauthorizedError('Invalid token'));
      }
    });

  requireRole = (userRoles: string[], requiredRole: string) =>
    Effect.gen(function* () {
      if (!userRoles.includes(requiredRole)) {
        return yield* Effect.fail(new EffectForbiddenError('Insufficient permissions'));
      }
      return undefined;
    });

  private verifyJWT(token: string): { upn: string; groups: string[] } {
    // Mock JWT verification - replace with real JWT library
    if (token === 'mock-admin-token') {
      return { upn: 'admin@example.com', groups: ['game.admin'] };
    }
    if (token === 'mock-user-token') {
      return { upn: 'user@example.com', groups: ['user'] };
    }
    throw new Error('Invalid token');
  }
}

// Service Layer Setup
const AuthServiceLive = Layer.succeed(AuthEffectServiceTag, new ProductionAuthService());

const AppDependencies = Layer.mergeAll(
  UserServiceEffectLive,
  AuthServiceLive,
  DatabaseLive
);

/**
 * Express Router with Effect-Enhanced Routes
 * This shows how to integrate Effect patterns with existing Express infrastructure
 */
export const createEffectEnhancedRouter = () => {
  const router = Router();

  // List users with Effect-enhanced logic
  router.get('/', async (req: Request, res: Response, next) => {
    try {
      const authHeader = req.headers.authorization;
      const result = await Effect.runPromise(
        listUsersEffect(req.query, authHeader).pipe(
          Effect.provide(AppDependencies)
        )
      );
      res.json(result);
    } catch (error) {
      if (error instanceof EffectHttpError) {
        res.status(error.statusCode).json({
          error: error.message,
          details: error.details
        });
      } else {
        next(error);
      }
    }
  });

  // Get single user with Effect-enhanced logic
  router.get('/:username', async (req: Request, res: Response, next) => {
    try {
      const authHeader = req.headers.authorization;
      const result = await Effect.runPromise(
        getUserEffect(req.params.username, authHeader).pipe(
          Effect.provide(AppDependencies)
        )
      );
      res.json(result);
    } catch (error) {
      if (error instanceof EffectHttpError) {
        res.status(error.statusCode).json({
          error: error.message,
          details: error.details
        });
      } else {
        next(error);
      }
    }
  });

  // Create user with Effect-enhanced logic
  router.post('/', async (req: Request, res: Response, next) => {
    try {
      const authHeader = req.headers.authorization;
      const result = await Effect.runPromise(
        createUserEffect(req.body, authHeader).pipe(
          Effect.provide(AppDependencies)
        )
      );
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof EffectHttpError) {
        res.status(error.statusCode).json({
          error: error.message,
          details: error.details
        });
      } else {
        next(error);
      }
    }
  });

  // Update user with Effect-enhanced logic
  router.put('/:username', async (req: Request, res: Response, next) => {
    try {
      const authHeader = req.headers.authorization;
      const result = await Effect.runPromise(
        updateUserEffect(req.params.username, req.body, authHeader).pipe(
          Effect.provide(AppDependencies)
        )
      );
      res.json(result);
    } catch (error) {
      if (error instanceof EffectHttpError) {
        res.status(error.statusCode).json({
          error: error.message,
          details: error.details
        });
      } else {
        next(error);
      }
    }
  });

  // Delete user with Effect-enhanced logic
  router.delete('/:username', async (req: Request, res: Response, next) => {
    try {
      const authHeader = req.headers.authorization;
      await Effect.runPromise(
        deleteUserEffect(req.params.username, authHeader).pipe(
          Effect.provide(AppDependencies)
        )
      );
      res.status(204).send();
    } catch (error) {
      if (error instanceof EffectHttpError) {
        res.status(error.statusCode).json({
          error: error.message,
          details: error.details
        });
      } else {
        next(error);
      }
    }
  });

  return router;
};

/**
 * Alternative approach using the runEffectRoute helper
 * This provides cleaner route definitions
 */
export const createEffectRouterWithHelper = () => {
  const router = Router();

  // Using the helper function for cleaner code
  router.get('/', (req, res, next) => {
    const effect = listUsersEffect(req.query, req.headers.authorization);
    const handler = async () => {
      try {
        const result = await Effect.runPromise(
          effect.pipe(Effect.provide(AppDependencies))
        );
        res.json(result);
      } catch (error) {
        if (error instanceof EffectHttpError) {
          res.status(error.statusCode).json({
            error: error.message,
            details: error.details
          });
        } else {
          next(error);
        }
      }
    };
    handler();
  });

  router.get('/:username', (req, res, next) => {
    const effect = getUserEffect(req.params.username, req.headers.authorization);
    const handler = async () => {
      try {
        const result = await Effect.runPromise(
          effect.pipe(Effect.provide(AppDependencies))
        );
        res.json(result);
      } catch (error) {
        if (error instanceof EffectHttpError) {
          res.status(error.statusCode).json({
            error: error.message,
            details: error.details
          });
        } else {
          next(error);
        }
      }
    };
    handler();
  });

  return router;
};

/**
 * Usage Examples:
 *
 * // In your main app.ts or routes/index.ts
 * import { createEffectEnhancedRouter } from './modules/users/user.routes-effect-demo';
 *
 * const app = express();
 * app.use('/hunt/users', createEffectEnhancedRouter());
 *
 * // Or use alongside traditional routes
 * import traditionalRouter from './modules/users/user.routes';
 * import { createEffectEnhancedRouter } from './modules/users/user.routes-effect-demo';
 *
 * app.use('/hunt/users', traditionalRouter);           // Traditional implementation
 * app.use('/hunt/effect-users', createEffectEnhancedRouter()); // Effect-enhanced implementation
 */

/**
 * Benefits of this Effect-Enhanced Approach:
 *
 * 1. **Composable Business Logic**: Effect operations can be composed and reused
 * 2. **Structured Error Handling**: Custom error types with proper HTTP status codes
 * 3. **Type Safety**: Full TypeScript support throughout the Effect chain
 * 4. **Dependency Injection**: Clean separation of concerns with Effect Context
 * 5. **Testing**: Easy to test business logic separately from HTTP concerns
 * 6. **Functional Programming**: Declarative rather than imperative code
 * 7. **Integration**: Works alongside existing Express infrastructure
 * 8. **Performance**: Effect's lazy evaluation and optimization
 * 9. **Resource Management**: Automatic cleanup and resource management
 * 10. **Observability**: Built-in logging and tracing capabilities
 *
 * Migration Strategy:
 * 1. Keep existing Express routes working
 * 2. Add Effect-enhanced routes on a separate path for testing
 * 3. Gradually migrate endpoints once confidence is built
 * 4. Eventually replace traditional routes with Effect-enhanced versions
 */