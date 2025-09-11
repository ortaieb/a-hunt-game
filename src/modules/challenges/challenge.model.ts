// src/modules/challenge/challenge.model.ts

import {
  ChallengeParticipantsData,
  ChallengeResponse,
  ChallengeParticipantResponse,
  CreateChallengeData,
  ChallengeParticipant,
  UpdateChallengeParticipantDetails,
} from './challenge.type';
import { eq, isNull, and } from 'drizzle-orm';
import { db } from './../../shared/database';
import { challengeParticipants, challenges } from '../../schema/challenges';

import { v7 as uuidv7 } from 'uuid';
import { DatabaseError } from 'pg';
import { ConflictError, NotFoundError } from '../../shared/types/errors';

export class ChallengeModel {
  static async allChallenges(): Promise<ChallengeResponse[]> {
    return await db.select().from(challenges).where(isNull(challenges.valid_until));
  }

  static async challengeById(challengeId: string): Promise<ChallengeResponse | undefined> {
    const result = await db
      .select()
      .from(challenges)
      .where(and(eq(challenges.challenge_id, challengeId), isNull(challenges.valid_until)))
      .limit(1);

    return result[0];
  }

  static async createChallenge(challengeData: CreateChallengeData): Promise<ChallengeResponse> {
    try {
      const result = await db
        .insert(challenges)
        .values({
          challenge_id: uuidv7(),
          challenge_inst_id: uuidv7(),
          challenge_name: challengeData.challengeName,
          challenge_desc: challengeData.challengeDesc,
          waypoints: challengeData.waypointsRef ?? '',
          start_time: challengeData.startTime,
          duration: challengeData.duration,
          valid_from: new Date(),
          valid_until: null,
        })
        .returning();

      if (!result[0]) {
        throw new Error('Failed to create Challenge record');
      }
      return result[0];
    } catch (error) {
      if (error instanceof DatabaseError) {
        if (error.code === '23505') {
          throw new ConflictError(`Challenge already exists (constraint: ${error.constraint})`);
        } else if (error.code === '23503') {
          throw new ConflictError(
            `Invalid reference in challenge (constraint: ${error.constraint})`,
          );
        }
      }
      throw error;
    }
  }

  static async updateChallenge(
    challengeId: string,
    challengeData: CreateChallengeData,
  ): Promise<ChallengeResponse> {
    return await db.transaction(async (tx) => {
      const now = new Date();

      await tx
        .update(challenges)
        .set({ valid_until: now })
        .where(and(eq(challenges.challenge_id, challengeId), isNull(challenges.valid_until)));

      const newData = {
        challenge_id: challengeId,
        challenge_inst_id: uuidv7(),
        challenge_name: challengeData.challengeName,
        challenge_desc: challengeData.challengeDesc,
        waypoints: challengeData.waypointsRef ?? '',
        start_time: challengeData.startTime,
        duration: challengeData.duration,
        valid_from: now,
        valid_until: null,
      };

      const result = await tx.insert(challenges).values(newData).returning();

      if (!result[0]) {
        throw new Error('Failed to update user');
      }

      return result[0];
    });
  }

  static async deleteChallenge(challengeId: string): Promise<void> {
    const result = await db
      .update(challenges)
      .set({ valid_until: new Date() })
      .where(and(eq(challenges.challenge_id, challengeId), isNull(challenges.valid_until)));

    if (result.rowCount === 0) {
      throw new Error('Challenge with id [${challengeId}] was not found');
    }
  }

  static async findParticipantByChallengeAndUser(
    challengeId: string,
    username: string,
  ): Promise<ChallengeParticipant> {
    // Find current active participant record
    const result = await db
      .select()
      .from(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.challenge_id, challengeId),
          eq(challengeParticipants.username, username),
          isNull(challengeParticipants.valid_until),
        ),
      )
      .limit(1);

    return result[0];
  }

  static async findByParticipantId(participantId: string): Promise<ChallengeParticipant> {
    // Find current active participant record
    const result = await db
      .select()
      .from(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.challenge_participant_id, participantId),
          isNull(challengeParticipants.valid_until),
        ),
      )
      .limit(1);

    return result[0];
  }

  static async findAllParticipantsByChallengeId(
    challengeId: string,
  ): Promise<ChallengeParticipant[]> {
    // Find all active participant records for the challenge-id
    const result = await db
      .select()
      .from(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.challenge_id, challengeId),
          isNull(challengeParticipants.valid_until),
        ),
      );

    return result;
  }

  static async createParticipants(
    participantsData: ChallengeParticipantsData,
  ): Promise<ChallengeParticipantResponse[]> {
    // Prepare all records at once
    const participantRecords = participantsData.participants.map((userName) => ({
      challenge_participant_id: uuidv7(),
      challenge_participant_inst_id: uuidv7(),
      challenge_id: participantsData.challengeId,
      username: userName,
      participant_name: '',
      state: 'PENDING' as const,
      valid_from: new Date(),
      valid_until: null,
    }));
    // call insert
    const result = await db.insert(challengeParticipants).values(participantRecords).returning();

    return result;
  }

  static async updateParticipantDetails(
    updateStateData: UpdateChallengeParticipantDetails,
  ): Promise<ChallengeParticipantResponse> {
    return await db.transaction(async (tx) => {
      const now = new Date();

      // Find current active participant record
      const currentInstance = await tx
        .select()
        .from(challengeParticipants)
        .where(
          and(
            eq(challengeParticipants.challenge_participant_id, updateStateData.participantId),
            eq(challengeParticipants.challenge_id, updateStateData.challengeId),
            isNull(challengeParticipants.valid_until),
          ),
        )
        .limit(1);

      if (!currentInstance[0]) {
        throw new Error(
          'Participant record ${updateStateData.participantId} @ {updateStateData.challengeId} not found',
        );
      }

      tx.update(challengeParticipants)
        .set({ valid_until: now })
        .where(
          eq(
            challengeParticipants.challenge_participant_inst_id,
            currentInstance[0].challenge_participant_inst_id,
          ),
        );

      const newData = {
        challenge_participant_id: currentInstance[0].challenge_participant_id,
        challenge_participant_inst_id: uuidv7(),
        challenge_id: currentInstance[0].challenge_id,
        username: currentInstance[0].username,
        participant_name: updateStateData.participantName ?? currentInstance[0].participant_name,
        state: updateStateData.state ?? currentInstance[0].state,
        valid_from: now,
        valid_until: null,
      };

      // Insert new version
      const result = await tx.insert(challengeParticipants).values(newData).returning();

      if (!result[0]) {
        throw new Error(
          'Failed to update Participant record ${updateStateData.participantId} @ {updateStateData.challengeId}',
        );
      }

      return result[0];
    });
  }

  static async deleteParticipants(challengeId: string): Promise<number | null> {
    const result = await db
      .update(challengeParticipants)
      .set({ valid_until: new Date() })
      .where(
        and(eq(challengeParticipants.challenge_id, challengeId), isNull(challenges.valid_until)),
      );

    if (result.rowCount === 0) {
      throw new Error('Challenge with id [${challengeId}] was not found');
    }

    return result.rowCount;
  }

  static async deleteParticipant(challengeId: string, participantId: string): Promise<void> {
    const result = await db
      .update(challengeParticipants)
      .set({ valid_until: new Date() })
      .where(
        and(
          eq(challengeParticipants.challenge_id, challengeId),
          eq(challengeParticipants.challenge_participant_id, participantId),
          isNull(challenges.valid_until),
        ),
      );

    if (result.rowCount != 1) {
      throw new NotFoundError('Participant ${participantId} @ ${challengeId} was not found');
    }
  }
}
