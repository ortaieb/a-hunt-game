// src/modules/challenges/challenges.validator.ts
import { z } from 'zod';
import { emailSchema } from '../users/user.validator';

// Helper function to convert kebab-case to camelCase
const toCamelCase = (str: string): string => {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
};

// Transform function to handle both kebab-case and camelCase inputs
const transformKeysToUserExp = <T extends Record<string, any>>(obj: T): any => {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key);
    result[camelKey] = value;
  }
  return result;
};

export const createChallengeSchema = z.object({
  body: z
    .record(z.string(), z.any()) // Accept any string keys with any values initially
    .transform((data) => {
      // Transform kebab-case keys to camelCase
      const transformed = transformKeysToUserExp(data);
      return transformed;
    })
    .pipe(
      z.object({
        challengeName: z
          .string()
          .min(3, 'Challenge-Name should not be less than 3 characters')
          .max(32, 'Challenge-Name should not be more than 32 characters')
          .trim(),
        challengeDesc: z
          .string()
          .max(255, 'Challenge description should not be more than 255 characters')
          .trim(),
        waypointsRef: z.string().optional(),
        startTime: z.string().datetime({ offset: true }),
        duration: z.number().min(0, 'Duration cannot be negative value'),
        invitedUsers: z.array(emailSchema).optional(),
      })
    ),
});

export const challengeWaypointSchema = z.object({
  body: z
    .record(z.string(), z.any()) // Accept any string keys with any values initially
    .transform((data) => {
      // Transform kebab-case keys to camelCase
      const transformed = transformKeysToUserExp(data);
      return transformed;
    })
    .pipe(
      z.object({
        challengeId: z.string().uuid().refine((val) => {
          // Check if it's UUIDv7 format (version 7 in the 13th character)
          return val.charAt(14) === '7';
        }, 'Must be a UUIDv7 format'),
        waypointsRef: z.string(),
      })
    ),
});

export const challengeParticipantsSchema = z.object({
  body: z
    .record(z.string(), z.any()) // Accept any string keys with any values initially
    .transform((data) => {
      // Transform kebab-case keys to camelCase
      const transformed = transformKeysToUserExp(data);
      return transformed;
    })
    .pipe(
      z.object({
        challengeId: z.string().uuid().refine((val) => {
          // Check if it's UUIDv7 format (version 7 in the 13th character)
          return val.charAt(14) === '7';
        }, 'Must be a UUIDv7 format'),
        invitedUsers: z.array(emailSchema).optional(),
      })
    ),
});

export type CreateChallengeSchema = z.infer<typeof createChallengeSchema>['body'];
export type ChallengeWaypointSchema = z.infer<typeof challengeWaypointSchema>['body'];
export type ChallengeParticipantsSchema = z.infer<typeof challengeParticipantsSchema>['body'];
