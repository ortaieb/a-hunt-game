// src/modules/user/challenges.validator.ts
import { z } from 'zod';
import { emailSchema } from '../users/user.validator';

export const createChallengeSchema = z.object({
  body: z.object({
    challengeName: z
      .string()
      .min(3, 'Challenge-Name should not be less than 3 characters')
      .max(32, 'Challenge-Name should not be more than 32 characters')
      .trim(),
    challengeDesc: z
      .string()
      .max(255, 'Challenge-Name should not be more than 255 characters')
      .trim(),
    waypointsRef: z.string().optional(),
    startTime: z.iso.datetime({ offset: true }),
    duration: z.number().min(0, 'DuraÏtion cannot be negative value'),
    invitedUsers: z.array(emailSchema).optional(),
  }),
});

export const challengeWaypointSchema = z.object({
  body: z.object({
    challengeId: z.uuidv7(),
    waypointsRef: z.string(),
  }),
});

export const challengeParticipantsSchema = z.object({
  body: z.object({
    challengeId: z.uuidv7(),
    invitedUsers: z.array(emailSchema).optional(),
  }),
});

export type CreateChallengeSchema = z.Infer<typeof createChallengeSchema>['body'];
export type ChallengeWaypointSchema = z.infer<typeof challengeWaypointSchema>['body'];
export type ChallengeParticipantsSchema = z.infer<typeof challengeParticipantsSchema>['body'];
