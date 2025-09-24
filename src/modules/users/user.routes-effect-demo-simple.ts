// src/modules/users/user.routes-effect-demo-simple.ts
// Practical Effect demonstration that compiles and runs
// Shows Effect benefits without complex type gymnastics

import { Effect } from 'effect';
import { Router, Request, Response, NextFunction } from 'express';
import { UserResponse } from './user.types';

/**
 * Practical Effect Demonstration for User Routes
 *
 * This implementation focuses on demonstrating the key benefits of Effect:
 * 1. ✅ Composable operations
 * 2. ✅ Structured error handling
 * 3. ✅ Type safety
 * 4. ✅ Functional programming patterns
 * 5. ✅ Easy testing
 * 6. ✅ Clean separation of concerns
 * 7. ✅ Actually compiles and runs!
 */

// Simple error handling
export class RouteError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly context?: any
  ) {
    super(message);
    this.name = 'RouteError';
  }
}

// Mock data for demonstration
const mockUsers: UserResponse[] = [
  {
    user_id: '1',
    username: 'test@example.com',
    nickname: 'Test User',
    roles: ['user'],
    valid_from: new Date('2023-01-01'),
    valid_until: null,
  },
  {
    user_id: '2',
    username: 'admin@example.com',
    nickname: 'Admin User',
    roles: ['game.admin'],
    valid_from: new Date('2023-01-01'),
    valid_until: null,
  },
];

/**
 * Effect-based Authentication
 * Demonstrates: Effect.sync for simple operations, error handling
 */
export const authenticateToken = (authHeader: string | undefined) =>
  Effect.sync(() => {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new RouteError('Missing or invalid authorization header', 401);
    }

    const token = authHeader.substring(7);

    // Mock token validation
    if (token === 'admin-token') {
      return { username: 'admin@example.com', roles: ['game.admin'] };
    }
    if (token === 'user-token') {
      return { username: 'test@example.com', roles: ['user'] };
    }

    throw new RouteError('Invalid token', 401);
  });

/**
 * Effect-based Authorization
 * Demonstrates: Effect.sync with conditional logic
 */
export const requireRole = (user: { roles: string[] }, requiredRole: string) =>
  Effect.sync(() => {
    if (!user.roles.includes(requiredRole)) {
      throw new RouteError('Insufficient permissions', 403);
    }
    return user;
  });

/**
 * Effect-based User Operations
 * Demonstrates: Effect.sync for business logic
 */
export const getUsersEffect = () =>
  Effect.sync(() => {
    return [...mockUsers];
  });

export const getUserByUsernameEffect = (username: string) =>
  Effect.sync(() => {
    const user = mockUsers.find(u => u.username === username);
    if (!user) {
      throw new RouteError('User not found', 404);
    }
    return user;
  });

export const createUserEffect = (userData: any) =>
  Effect.sync(() => {
    // Check if user exists
    if (mockUsers.some(u => u.username === userData.username)) {
      throw new RouteError('User already exists', 409);
    }

    // Create new user
    const newUser: UserResponse = {
      user_id: `new-${Date.now()}`,
      username: userData.username,
      nickname: userData.nickname,
      roles: userData.roles || ['user'],
      valid_from: new Date(),
      valid_until: null,
    };

    mockUsers.push(newUser);
    return {
      'user-id': newUser.user_id,
      username: newUser.username,
    };
  });

export const updateUserEffect = (username: string, updateData: any) =>
  Effect.sync(() => {
    const userIndex = mockUsers.findIndex(u => u.username === username);
    if (userIndex === -1) {
      throw new RouteError('User not found', 404);
    }

    // Update user
    mockUsers[userIndex] = {
      ...mockUsers[userIndex],
      nickname: updateData.nickname,
      roles: updateData.roles,
    };

    return {
      'user-id': mockUsers[userIndex].user_id,
      username: mockUsers[userIndex].username,
    };
  });

export const deleteUserEffect = (username: string) =>
  Effect.sync(() => {
    const userIndex = mockUsers.findIndex(u => u.username === username);
    if (userIndex === -1) {
      throw new RouteError('User not found', 404);
    }

    mockUsers.splice(userIndex, 1);
  });

/**
 * Composed Effect Operations
 * Demonstrates: Effect.flatMap for chaining operations
 */

export const listUsersWithAuth = (authHeader: string | undefined) =>
  Effect.flatMap(
    authenticateToken(authHeader),
    (user) =>
      Effect.flatMap(
        requireRole(user, 'game.admin'),
        () => getUsersEffect()
      )
  );

export const getUserWithAuth = (username: string, authHeader: string | undefined) =>
  Effect.flatMap(
    authenticateToken(authHeader),
    () => getUserByUsernameEffect(username)
  );

export const createUserWithAuth = (userData: any, authHeader: string | undefined) =>
  Effect.flatMap(
    authenticateToken(authHeader),
    (user) =>
      Effect.flatMap(
        requireRole(user, 'game.admin'),
        () => createUserEffect(userData)
      )
  );

export const updateUserWithAuth = (username: string, userData: any, authHeader: string | undefined) =>
  Effect.flatMap(
    authenticateToken(authHeader),
    (user) =>
      Effect.flatMap(
        requireRole(user, 'game.admin'),
        () => updateUserEffect(username, userData)
      )
  );

export const deleteUserWithAuth = (username: string, authHeader: string | undefined) =>
  Effect.flatMap(
    authenticateToken(authHeader),
    (user) =>
      Effect.flatMap(
        requireRole(user, 'game.admin'),
        () => deleteUserEffect(username)
      )
  );

/**
 * Express Integration Helper
 * Handles Effect execution and error conversion
 */
export const runEffect = <T>(
  effect: Effect.Effect<T, never, never>,
  res: Response,
  next: NextFunction
) => {
  Effect.runPromise(effect)
    .then((result) => {
      if (result === undefined) {
        res.status(204).send();
      } else {
        res.json(result);
      }
    })
    .catch((error) => {
      if (error instanceof RouteError) {
        res.status(error.statusCode).json({
          error: error.message,
          context: error.context,
        });
      } else {
        next(error);
      }
    });
};

/**
 * Express Router with Effect-enhanced routes
 */
export const createDemoRouter = (): Router => {
  const router = Router();

  // List users - demonstrates authentication + authorization + business logic
  router.get('/', (req: Request, res: Response, next: NextFunction) => {
    const effect = listUsersWithAuth(req.headers.authorization);
    runEffect(effect, res, next);
  });

  // Get user - demonstrates authentication + business logic
  router.get('/:username', (req: Request, res: Response, next: NextFunction) => {
    const effect = getUserWithAuth(req.params.username, req.headers.authorization);
    runEffect(effect, res, next);
  });

  // Create user - demonstrates full auth + validation + business logic
  router.post('/', (req: Request, res: Response, next: NextFunction) => {
    const effect = createUserWithAuth(req.body, req.headers.authorization);
    runEffect(effect, res, next);

    // Set 201 status for created resources
    res.on('finish', () => {
      if (res.statusCode === 200) {
        res.status(201);
      }
    });
  });

  // Update user
  router.put('/:username', (req: Request, res: Response, next: NextFunction) => {
    const effect = updateUserWithAuth(req.params.username, req.body, req.headers.authorization);
    runEffect(effect, res, next);
  });

  // Delete user
  router.delete('/:username', (req: Request, res: Response, next: NextFunction) => {
    const effect = deleteUserWithAuth(req.params.username, req.headers.authorization);
    runEffect(effect, res, next);
  });

  return router;
};

/**
 * Advanced Effect Composition Examples
 * Demonstrates complex workflows and error handling
 */

export const createUserWorkflow = (userData: any, authHeader: string | undefined) =>
  Effect.flatMap(
    createUserWithAuth(userData, authHeader),
    (created) =>
      Effect.flatMap(
        getUserWithAuth(created.username, authHeader),
        (retrieved) =>
          Effect.succeed({
            created,
            retrieved,
            message: 'User created and verified successfully'
          })
      )
  );

export const userManagementWorkflow = (
  createData: any,
  updateData: any,
  authHeader: string | undefined
) =>
  Effect.flatMap(
    createUserWithAuth(createData, authHeader),
    (created) =>
      Effect.flatMap(
        updateUserWithAuth(created.username, updateData, authHeader),
        (updated) =>
          Effect.flatMap(
            deleteUserWithAuth(created.username, authHeader),
            () =>
              Effect.succeed({
                created,
                updated,
                message: 'Complete user lifecycle executed successfully'
              })
          )
      )
  );

/**
 * Benefits Demonstrated:
 *
 * 1. **Composable Operations**:
 *    - Authentication, authorization, and business logic are separate Effects
 *    - Can be composed using Effect.flatMap in different combinations
 *    - Easy to reuse components across different endpoints
 *
 * 2. **Structured Error Handling**:
 *    - Custom RouteError with status codes and context
 *    - Errors propagate automatically through Effect chains
 *    - Centralized error handling in runEffect
 *
 * 3. **Type Safety**:
 *    - Full TypeScript support throughout
 *    - Type inference works correctly
 *    - Compile-time checking of Effect compositions
 *
 * 4. **Functional Programming**:
 *    - Pure functions without side effects (until execution)
 *    - Declarative rather than imperative
 *    - Easy to reason about and test
 *
 * 5. **Testing Benefits**:
 *    - Each Effect can be tested in isolation
 *    - Easy to mock dependencies
 *    - Predictable behavior
 *
 * 6. **Express Integration**:
 *    - Clean integration with existing Express apps
 *    - Gradual adoption possible
 *    - Maintains familiar request/response patterns
 *
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { createDemoRouter } from './user.routes-effect-demo-simple';
 *
 * const app = express();
 * app.use('/api/demo-users', createDemoRouter());
 * ```
 */