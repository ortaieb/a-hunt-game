import { z } from 'zod';

// Reusable schemas
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one number');

const emailSchema = z.email('Must be a valid email address').toLowerCase().trim();

const rolesSchema = z
  .array(z.enum(['game.admin', 'game.player', 'viewer']))
  .min(1, 'At least one role is required');

// Request validation schemas
export const createUserSchema = z.object({
  body: z.object({
    username: emailSchema,
    password: passwordSchema,
    nickname: z.string().min(1, 'Nickname is required').trim(),
    roles: rolesSchema,
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    username: emailSchema,
  }),
  body: z.object({
    username: emailSchema,
    password: passwordSchema.optional(),
    nickname: z.string().min(1, 'Nickname is required').trim(),
    roles: rolesSchema,
  }),
});

export const deleteUserSchema = z.object({
  params: z.object({
    username: emailSchema,
  }),
});

export const listUsersSchema = z.object({
  query: z
    .object({
      includeDeleted: z.coerce.boolean().optional(),
      role: z.string().optional(),
    })
    .optional(),
});

// Export inferred types
export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];
