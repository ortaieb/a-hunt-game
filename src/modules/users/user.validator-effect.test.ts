// src/modules/users/user.validator-effect.test.ts
// Comprehensive test suite for Effect-based user validation

import { Effect } from 'effect';
import {
  validateCreateUser,
  validateUpdateUser,
  validateDeleteUser,
  validateListUsers,
  validateEmail,
  validatePassword,
  validateRoles,
  ValidationError,
  CreateUserInput,
  UpdateUserInput,
  DeleteUserParams,
  ListUsersQuery,
} from './user.validator-effect';

describe('Effect-based User Validator', () => {
  describe('validateCreateUser', () => {
    it('should validate valid create user input', async () => {
      const validInput = {
        body: {
          username: 'test@example.com',
          password: 'password123',
          nickname: 'Test User',
          roles: ['game.player'],
        },
      };

      const result = await Effect.runPromise(validateCreateUser(validInput));

      expect(result.body.username).toBe('test@example.com');
      expect(result.body.password).toBe('password123');
      expect(result.body.nickname).toBe('Test User');
      expect(result.body.roles).toEqual(['game.player']);
    });

    it('should transform email to lowercase and trim nickname', async () => {
      const validInput = {
        body: {
          username: '  TEST@EXAMPLE.COM  ',
          password: 'password123',
          nickname: '  Test User  ',
          roles: ['game.admin'],
        },
      };

      const result = await Effect.runPromise(validateCreateUser(validInput));

      expect(result.body.username).toBe('test@example.com');
      expect(result.body.nickname).toBe('Test User');
    });

    it('should reject invalid email format', async () => {
      const invalidInput = {
        body: {
          username: 'invalid-email',
          password: 'password123',
          nickname: 'Test User',
          roles: ['game.player'],
        },
      };

      const effect = validateCreateUser(invalidInput);
      await expect(Effect.runPromise(effect)).rejects.toThrow('Create user validation failed');
    });

    it('should reject password shorter than 8 characters', async () => {
      const invalidInput = {
        body: {
          username: 'test@example.com',
          password: 'short',
          nickname: 'Test User',
          roles: ['game.player'],
        },
      };

      const effect = validateCreateUser(invalidInput);
      await expect(Effect.runPromise(effect)).rejects.toThrow('Create user validation failed');
    });

    it('should reject password without letters', async () => {
      const invalidInput = {
        body: {
          username: 'test@example.com',
          password: '12345678',
          nickname: 'Test User',
          roles: ['game.player'],
        },
      };

      const effect = validateCreateUser(invalidInput);
      await expect(Effect.runPromise(effect)).rejects.toThrow('Create user validation failed');
    });

    it('should reject password without numbers', async () => {
      const invalidInput = {
        body: {
          username: 'test@example.com',
          password: 'passwordonly',
          nickname: 'Test User',
          roles: ['game.player'],
        },
      };

      const effect = validateCreateUser(invalidInput);
      await expect(Effect.runPromise(effect)).rejects.toThrow('Create user validation failed');
    });

    it('should reject empty nickname', async () => {
      const invalidInput = {
        body: {
          username: 'test@example.com',
          password: 'password123',
          nickname: '',
          roles: ['game.player'],
        },
      };

      const effect = validateCreateUser(invalidInput);
      await expect(Effect.runPromise(effect)).rejects.toThrow('Create user validation failed');
    });

    it('should reject empty roles array', async () => {
      const invalidInput = {
        body: {
          username: 'test@example.com',
          password: 'password123',
          nickname: 'Test User',
          roles: [],
        },
      };

      const effect = validateCreateUser(invalidInput);
      await expect(Effect.runPromise(effect)).rejects.toThrow('Create user validation failed');
    });

    it('should reject invalid roles', async () => {
      const invalidInput = {
        body: {
          username: 'test@example.com',
          password: 'password123',
          nickname: 'Test User',
          roles: ['invalid-role'],
        },
      };

      const effect = validateCreateUser(invalidInput);
      await expect(Effect.runPromise(effect)).rejects.toThrow('Create user validation failed');
    });

    it('should accept all valid roles', async () => {
      const validInput = {
        body: {
          username: 'test@example.com',
          password: 'password123',
          nickname: 'Test User',
          roles: ['game.admin', 'game.player', 'viewer'],
        },
      };

      const result = await Effect.runPromise(validateCreateUser(validInput));
      expect(result.body.roles).toEqual(['game.admin', 'game.player', 'viewer']);
    });
  });

  describe('validateUpdateUser', () => {
    it('should validate valid update user input with password', async () => {
      const validInput = {
        params: {
          username: 'test@example.com',
        },
        body: {
          username: 'updated@example.com',
          password: 'newpassword123',
          nickname: 'Updated User',
          roles: ['game.admin'],
        },
      };

      const result = await Effect.runPromise(validateUpdateUser(validInput));

      expect(result.params.username).toBe('test@example.com');
      expect(result.body.username).toBe('updated@example.com');
      expect(result.body.password).toBe('newpassword123');
      expect(result.body.nickname).toBe('Updated User');
      expect(result.body.roles).toEqual(['game.admin']);
    });

    it('should validate valid update user input without password', async () => {
      const validInput = {
        params: {
          username: 'test@example.com',
        },
        body: {
          username: 'updated@example.com',
          nickname: 'Updated User',
          roles: ['game.admin'],
        },
      };

      const result = await Effect.runPromise(validateUpdateUser(validInput));

      expect(result.params.username).toBe('test@example.com');
      expect(result.body.username).toBe('updated@example.com');
      expect(result.body.password).toBeUndefined();
      expect(result.body.nickname).toBe('Updated User');
      expect(result.body.roles).toEqual(['game.admin']);
    });

    it('should reject invalid param email', async () => {
      const invalidInput = {
        params: {
          username: 'invalid-email',
        },
        body: {
          username: 'test@example.com',
          nickname: 'Test User',
          roles: ['game.player'],
        },
      };

      const effect = validateUpdateUser(invalidInput);
      await expect(Effect.runPromise(effect)).rejects.toThrow('Update user validation failed');
    });

    it('should reject invalid body email', async () => {
      const invalidInput = {
        params: {
          username: 'test@example.com',
        },
        body: {
          username: 'invalid-email',
          nickname: 'Test User',
          roles: ['game.player'],
        },
      };

      const effect = validateUpdateUser(invalidInput);
      await expect(Effect.runPromise(effect)).rejects.toThrow('Update user validation failed');
    });
  });

  describe('validateDeleteUser', () => {
    it('should validate valid delete user input', async () => {
      const validInput = {
        params: {
          username: 'test@example.com',
        },
      };

      const result = await Effect.runPromise(validateDeleteUser(validInput));
      expect(result.params.username).toBe('test@example.com');
    });

    it('should reject invalid email in params', async () => {
      const invalidInput = {
        params: {
          username: 'invalid-email',
        },
      };

      const effect = validateDeleteUser(invalidInput);
      await expect(Effect.runPromise(effect)).rejects.toThrow('Delete user validation failed');
    });
  });

  describe('validateListUsers', () => {
    it('should validate empty query', async () => {
      const validInput = {};

      const result = await Effect.runPromise(validateListUsers(validInput));
      expect(result.query).toBeUndefined();
    });

    it('should validate query with includeDeleted as string "true"', async () => {
      const validInput = {
        query: {
          includeDeleted: 'true',
          role: 'game.admin',
        },
      };

      const result = await Effect.runPromise(validateListUsers(validInput));
      expect(result.query?.includeDeleted).toBe(true);
      expect(result.query?.role).toBe('game.admin');
    });

    it('should validate query with includeDeleted as string "false"', async () => {
      const validInput = {
        query: {
          includeDeleted: 'false',
        },
      };

      const result = await Effect.runPromise(validateListUsers(validInput));
      expect(result.query?.includeDeleted).toBe(false);
    });

    it('should validate query with role only', async () => {
      const validInput = {
        query: {
          role: 'game.player',
        },
      };

      const result = await Effect.runPromise(validateListUsers(validInput));
      expect(result.query?.role).toBe('game.player');
      expect(result.query?.includeDeleted).toBeUndefined();
    });
  });

  describe('Individual field validators', () => {
    describe('validateEmail', () => {
      it('should validate and transform valid email', async () => {
        const result = await Effect.runPromise(validateEmail('  TEST@EXAMPLE.COM  '));
        expect(result).toBe('test@example.com');
      });

      it('should reject invalid email', async () => {
        const effect = validateEmail('invalid-email');
        await expect(Effect.runPromise(effect)).rejects.toThrow('Email validation failed');
      });

      it('should reject non-string input', async () => {
        const effect = validateEmail(123);
        await expect(Effect.runPromise(effect)).rejects.toThrow('Email validation failed');
      });
    });

    describe('validatePassword', () => {
      it('should validate valid password', async () => {
        const result = await Effect.runPromise(validatePassword('password123'));
        expect(result).toBe('password123');
      });

      it('should reject short password', async () => {
        const effect = validatePassword('short');
        await expect(Effect.runPromise(effect)).rejects.toThrow('Password validation failed');
      });

      it('should reject password without letters', async () => {
        const effect = validatePassword('12345678');
        await expect(Effect.runPromise(effect)).rejects.toThrow('Password validation failed');
      });

      it('should reject password without numbers', async () => {
        const effect = validatePassword('passwordonly');
        await expect(Effect.runPromise(effect)).rejects.toThrow('Password validation failed');
      });
    });

    describe('validateRoles', () => {
      it('should validate valid single role', async () => {
        const result = await Effect.runPromise(validateRoles(['game.admin']));
        expect(result).toEqual(['game.admin']);
      });

      it('should validate valid multiple roles', async () => {
        const result = await Effect.runPromise(validateRoles(['game.admin', 'game.player']));
        expect(result).toEqual(['game.admin', 'game.player']);
      });

      it('should validate all valid role types', async () => {
        const validRoles = ['game.admin', 'game.player', 'viewer'];
        const result = await Effect.runPromise(validateRoles(validRoles));
        expect(result).toEqual(validRoles);
      });

      it('should reject empty roles array', async () => {
        const effect = validateRoles([]);
        await expect(Effect.runPromise(effect)).rejects.toThrow('Roles validation failed');
      });

      it('should reject invalid role', async () => {
        const effect = validateRoles(['invalid-role']);
        await expect(Effect.runPromise(effect)).rejects.toThrow('Roles validation failed');
      });

      it('should reject non-array input', async () => {
        const effect = validateRoles('game.admin');
        await expect(Effect.runPromise(effect)).rejects.toThrow('Roles validation failed');
      });
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with message and cause', () => {
      const cause = new Error('Original error');
      const error = new ValidationError('Test validation failed', cause);

      expect(error.message).toBe('Test validation failed');
      expect(error.cause).toBe(cause);
      expect(error._tag).toBe('ValidationError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create ValidationError without cause', () => {
      const error = new ValidationError('Test validation failed');

      expect(error.message).toBe('Test validation failed');
      expect(error.cause).toBeUndefined();
      expect(error._tag).toBe('ValidationError');
    });
  });

  describe('Type exports', () => {
    it('should export correct types', () => {
      // This test ensures the types are properly exported and can be used
      const createInput: CreateUserInput = {
        username: 'test@example.com',
        password: 'password123',
        nickname: 'Test User',
        roles: ['game.player'],
      };

      const updateInput: UpdateUserInput = {
        username: 'test@example.com',
        nickname: 'Test User',
        roles: ['game.player'],
      };

      const deleteParams: DeleteUserParams = {
        username: 'test@example.com',
      };

      const listQuery: ListUsersQuery = {
        includeDeleted: true,
        role: 'game.admin',
      };

      expect(createInput.username).toBe('test@example.com');
      expect(updateInput.username).toBe('test@example.com');
      expect(deleteParams.username).toBe('test@example.com');
      expect(listQuery.includeDeleted).toBe(true);
    });
  });

  describe('Effect composition examples', () => {
    it('should compose validation with other Effects', async () => {
      const processUser = (input: unknown) =>
        Effect.gen(function* () {
          const validated = yield* validateCreateUser(input);
          // Simulate additional processing
          const processed = {
            ...validated.body,
            processedAt: new Date().toISOString(),
          };
          return processed;
        });

      const validInput = {
        body: {
          username: 'test@example.com',
          password: 'password123',
          nickname: 'Test User',
          roles: ['game.player'],
        },
      };

      const result = await Effect.runPromise(processUser(validInput));

      expect(result.username).toBe('test@example.com');
      expect(result.processedAt).toBeDefined();
    });

    it('should handle validation errors in composed Effects', async () => {
      const processUser = (input: unknown) =>
        Effect.gen(function* () {
          const validated = yield* validateCreateUser(input);
          return validated.body;
        });

      const invalidInput = {
        body: {
          username: 'invalid-email',
          password: 'password123',
          nickname: 'Test User',
          roles: ['game.player'],
        },
      };

      const effect = processUser(invalidInput);
      await expect(Effect.runPromise(effect)).rejects.toThrow('Create user validation failed');
    });

    it('should handle validation errors with Effect.catchAll', async () => {
      const safeValidation = (input: unknown) =>
        validateCreateUser(input).pipe(
          Effect.catchAll((error) => {
            return Effect.succeed({
              error: true,
              message: error.message,
            });
          })
        );

      const invalidInput = {
        body: {
          username: 'invalid-email',
          password: 'password123',
          nickname: 'Test User',
          roles: ['game.player'],
        },
      };

      const result = await Effect.runPromise(safeValidation(invalidInput));

      expect(result).toEqual({
        error: true,
        message: 'Create user validation failed',
      });
    });
  });
});
