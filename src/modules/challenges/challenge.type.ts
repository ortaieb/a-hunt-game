// src/modules/challenge/challenges.types.ts
import type {
  Challenge as DbChallenge,
  ChallengeParticipant as DbChallengeParticipant,
  ChallengeParticipantState,
} from '../../schema/challenges';

// Re-export the database user type
export type Challenge = DbChallenge;
export type ChallengeParticipant = DbChallengeParticipant;

// Transform for API responses (hiding password_hash)
export type ChallengeResponse = Omit<
  Challenge,
  'valid_from' | 'valid_until' | 'challenge_inst_id'
> & { invitedCount?: number };
export type ChallengeParticipantResponse = Omit<
  ChallengeParticipant,
  'valid_from' | 'valid_until' | 'challenge_participant_inst_id'
>;

export interface CreateChallengeData {
  challengeName: string;
  challengeDesc: string;
  waypointsRef?: string;
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

export interface UpdateChallengeParticipantDetails {
  challengeId: string;
  participantId: string;
  state?: ChallengeParticipantState;
  participantName?: string;
}
