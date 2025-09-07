// src/modules/user/challenges.types.ts
import type { Challenge as DbChallenge } from '../../schema/challenges';

// Re-export the database user type
export type Challenge = DbChallenge;

// Transform for API responses (hiding password_hash)
export type ChallengeResponse = Omit<Challenge, 'valid_from' | 'valid_until' | 'challenge_inst_id'>;

export interface CreateChallengeData {
  challengeName: string;
  challengeDesc: string;
  waypointsRef: string;
  startTime: Date;
  duration: number;
}

export interface UpdateChallengeData {
  challengeName: string;
  challengeDesc: string;
  waypointsRef: string;
  startTime: Date;
  duration: number;
}

export interface ChallengeParticipantsData {
  challengeId: string;
  participants: string[];
}
