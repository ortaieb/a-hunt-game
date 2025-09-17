import { AppError, NotFoundError } from '../../shared/types/errors';
import { ChallengeModel } from './challenge.model';
import {
  Challenge,
  ChallengeParticipantResponse,
  ChallengeParticipantsData,
  ChallengeResponse,
} from './challenge.type';
import { CreateChallengeInput } from './challenge.validator';

export class ChallengeService {
  private toResponse(challenge: Challenge): ChallengeResponse {
    const { ...challengeResponse } = challenge;
    return challengeResponse;
  }

  async activeChallenges(): Promise<ChallengeResponse[]> {
    return await ChallengeModel.allChallenges();
  }

  async getChallenge(challengeId: string): Promise<ChallengeResponse> {
    const result = await ChallengeModel.challengeById(challengeId);
    if (!result) {
      throw new NotFoundError(`Challenge [${challengeId}] was not found`);
    }
    return result;
  }

  async getParticipant(participantId: string): Promise<ChallengeParticipantResponse> {
    return await ChallengeModel.findByParticipantId(participantId);
  }

  async getParticipantByChallengeAndUsername(
    challengeId: string,
    username: string,
  ): Promise<ChallengeParticipantResponse> {
    return await ChallengeModel.findParticipantByChallengeAndUser(challengeId, username);
  }

  async getParticipantsByChallengeId(challengeId: string): Promise<ChallengeParticipantResponse[]> {
    return await ChallengeModel.findAllParticipantsByChallengeId(challengeId);
  }

  async createChallenge(data: CreateChallengeInput): Promise<ChallengeResponse> {
    const challenge = await ChallengeModel.createChallenge(data);

    const challengeParticipants = {
      challengeId: challenge.challenge_id,
      participants: data.invitedUsers ?? [],
    };
    const participants = await ChallengeModel.createParticipants(challengeParticipants);

    return {
      ...challenge,
      invitedCount: participants.length,
    };
  }

  // TODO: We're using CreateChallengeInput as argument but at this stage we cannot manage users the same way (e.g. remove invited/accepted users).
  async updateChallenge(
    challengeId: string,
    data: CreateChallengeInput,
  ): Promise<ChallengeResponse> {
    return await ChallengeModel.updateChallenge(challengeId, data);
  }

  // TODO: we should build notification event for `challenge cancelled`.
  async deleteChallenge(challengeId: string): Promise<void> {
    try {
      await ChallengeModel.deleteParticipants(challengeId);
      return await ChallengeModel.deleteChallenge(challengeId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error: ' + errorMessage);
      throw new AppError(`Failed to cancel challenge [${challengeId}: ${errorMessage}.`, 500);
    }
  }

  async inviteParticipant(
    challengeId: string,
    username: string,
  ): Promise<ChallengeParticipantResponse> {
    const participant = await ChallengeModel.findParticipantByChallengeAndUser(
      challengeId,
      username,
    );
    if (participant != undefined) {
      return participant;
    } else {
      const newParticipant = await ChallengeModel.createParticipants({
        challengeId: challengeId,
        participants: [username],
      });

      return newParticipant[0];
    }
  }

  async inviteParticipants(
    participantsData: ChallengeParticipantsData,
  ): Promise<ChallengeParticipantResponse[]> {
    const invitedParticipants = participantsData.participants.map(part =>
      this.inviteParticipant(participantsData.challengeId, part),
    );

    return Promise.all(invitedParticipants);
  }
}

export const challengeService = new ChallengeService();
