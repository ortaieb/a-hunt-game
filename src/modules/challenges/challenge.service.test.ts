// Mock the ChallengeModel module - focusing on service behavior
jest.mock('./challenge.model');
jest.mock('./events/challenge.event-bus');

import { ChallengeService } from './challenge.service';
import { ChallengeModel } from './challenge.model';
import { AppError, NotFoundError, ConflictError } from '../../shared/types/errors';
import { CreateChallengeInput } from './challenge.validator';
import { challengeEventBus } from './events/challenge.event-bus';

const mockChallengeModel = ChallengeModel as jest.Mocked<typeof ChallengeModel>;
const mockChallengeEventBus = challengeEventBus as jest.Mocked<typeof challengeEventBus>;

describe('ChallengeService', () => {
  let challengeService: ChallengeService;

  // Sample test data
  const sampleChallenge = {
    challenge_id: 'test-challenge-id',
    challenge_inst_id: 'test-challenge-inst-id',
    challenge_name: 'Adventure Hunt',
    challenge_desc: 'A thrilling adventure challenge',
    waypoints: 'central-park-waypoints',
    start_time: new Date('2024-01-15T10:00:00Z'),
    duration: 120,
    valid_from: new Date('2024-01-01T00:00:00Z'),
    valid_until: null,
  };

  const sampleChallengeResponse = {
    challenge_id: 'test-challenge-id',
    challenge_name: 'Adventure Hunt',
    challenge_desc: 'A thrilling adventure challenge',
    waypoints: 'central-park-waypoints',
    start_time: new Date('2024-01-15T10:00:00Z'),
    duration: 120,
  };

  const sampleCreateChallengeInput: CreateChallengeInput = {
    challengeName: 'Adventure Hunt',
    challengeDesc: 'A thrilling adventure challenge',
    waypointsRef: 'central-park-waypoints',
    startTime: new Date('2024-01-15T10:00:00Z'),
    duration: 120,
    invitedUsers: ['user1@example.com', 'user2@example.com'],
  };

  const sampleParticipants = [
    {
      challenge_participant_id: 'participant-1',
      challenge_participant_inst_id: 'participant-inst-1',
      challenge_id: 'test-challenge-id',
      username: 'user1@example.com',
      participant_name: 'User One',
      state: 'PENDING' as const,
      valid_from: new Date('2024-01-01T00:00:00Z'),
      valid_until: null,
    },
    {
      challenge_participant_id: 'participant-2',
      challenge_participant_inst_id: 'participant-inst-2',
      challenge_id: 'test-challenge-id',
      username: 'user2@example.com',
      participant_name: 'User Two',
      state: 'ACCEPTED' as const,
      valid_from: new Date('2024-01-01T00:00:00Z'),
      valid_until: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    challengeService = new ChallengeService();
  });

  describe('getChallenge', () => {
    describe('Happy Path', () => {
      it('should return challenge when found', async () => {
        mockChallengeModel.challengeById.mockResolvedValue(sampleChallenge);

        const result = await challengeService.getChallenge('test-challenge-id');

        expect(mockChallengeModel.challengeById).toHaveBeenCalledWith('test-challenge-id');
        expect(result).toEqual(sampleChallenge);
      });

      it('should handle different challenge IDs correctly', async () => {
        const differentChallenge = {
          ...sampleChallenge,
          challenge_id: 'different-id',
        };
        mockChallengeModel.challengeById.mockResolvedValue(differentChallenge);

        const result = await challengeService.getChallenge('different-id');

        expect(mockChallengeModel.challengeById).toHaveBeenCalledWith('different-id');
        expect(result).toEqual(differentChallenge);
      });
    });

    describe('Missing Data/Error Cases', () => {
      it('should throw NotFoundError when challenge not found', async () => {
        mockChallengeModel.challengeById.mockResolvedValue(undefined);

        await expect(challengeService.getChallenge('nonexistent-challenge')).rejects.toThrow(
          NotFoundError,
        );
        await expect(challengeService.getChallenge('nonexistent-challenge')).rejects.toThrow(
          'Challenge [nonexistent-challenge] was not found',
        );

        expect(mockChallengeModel.challengeById).toHaveBeenCalledWith('nonexistent-challenge');
      });

      it('should handle null return from model', async () => {
        mockChallengeModel.challengeById.mockResolvedValue(null as any);

        await expect(challengeService.getChallenge('challenge-id')).rejects.toThrow(NotFoundError);
      });
    });

    describe('Error Propagation from Model Layer', () => {
      it('should propagate model database errors', async () => {
        const dbError = new Error('Database connection failed');
        mockChallengeModel.challengeById.mockRejectedValue(dbError);

        await expect(challengeService.getChallenge('test-challenge-id')).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should handle model layer constraint errors', async () => {
        const constraintError = new Error('Invalid UUID format');
        mockChallengeModel.challengeById.mockRejectedValue(constraintError);

        await expect(challengeService.getChallenge('invalid-uuid')).rejects.toThrow(
          'Invalid UUID format',
        );
      });
    });
  });

  describe('getParticipantsByChallengeId', () => {
    describe('Happy Path', () => {
      it('should return participants array when found', async () => {
        mockChallengeModel.findAllParticipantsByChallengeId.mockResolvedValue(sampleParticipants);

        const result = await challengeService.getParticipantsByChallengeId('test-challenge-id');

        expect(mockChallengeModel.findAllParticipantsByChallengeId).toHaveBeenCalledWith(
          'test-challenge-id',
        );
        expect(result).toEqual(sampleParticipants);
        expect(result).toHaveLength(2);
      });

      it('should return empty array when no participants found', async () => {
        mockChallengeModel.findAllParticipantsByChallengeId.mockResolvedValue([]);

        const result = await challengeService.getParticipantsByChallengeId('empty-challenge');

        expect(result).toEqual([]);
        expect(result).toHaveLength(0);
      });

      it('should handle different challenge IDs correctly', async () => {
        const differentParticipants = [sampleParticipants[0]];
        mockChallengeModel.findAllParticipantsByChallengeId.mockResolvedValue(
          differentParticipants,
        );

        const result = await challengeService.getParticipantsByChallengeId('another-challenge');

        expect(mockChallengeModel.findAllParticipantsByChallengeId).toHaveBeenCalledWith(
          'another-challenge',
        );
        expect(result).toEqual(differentParticipants);
      });
    });

    describe('Error Propagation from Model Layer', () => {
      it('should propagate model database errors', async () => {
        const dbError = new Error('Query timeout');
        mockChallengeModel.findAllParticipantsByChallengeId.mockRejectedValue(dbError);

        await expect(
          challengeService.getParticipantsByChallengeId('test-challenge-id'),
        ).rejects.toThrow('Query timeout');
      });

      it('should handle model layer connection errors', async () => {
        const connectionError = new Error('Connection to database lost');
        mockChallengeModel.findAllParticipantsByChallengeId.mockRejectedValue(connectionError);

        await expect(
          challengeService.getParticipantsByChallengeId('test-challenge-id'),
        ).rejects.toThrow('Connection to database lost');
      });
    });
  });

  describe('createChallenge', () => {
    describe('Happy Path', () => {
      it('should create challenge and participants successfully', async () => {
        const createdParticipants = [
          { ...sampleParticipants[0], state: 'PENDING' as const },
          { ...sampleParticipants[1], state: 'PENDING' as const },
        ];

        mockChallengeModel.createChallenge.mockResolvedValue(sampleChallenge);
        mockChallengeModel.createParticipants.mockResolvedValue(createdParticipants);

        const result = await challengeService.createChallenge(sampleCreateChallengeInput);

        expect(mockChallengeModel.createChallenge).toHaveBeenCalledWith(sampleCreateChallengeInput);
        expect(mockChallengeModel.createParticipants).toHaveBeenCalledWith({
          challengeId: 'test-challenge-id',
          participants: ['user1@example.com', 'user2@example.com'],
        });
        expect(mockChallengeEventBus.emitChallengeCreated).toHaveBeenCalledWith({
          challengeId: 'test-challenge-id',
          startTime: sampleChallenge.start_time,
        });
        expect(result).toEqual({
          ...sampleChallenge,
          invitedCount: 2,
        });
      });

      it('should handle challenge creation without invited users', async () => {
        const inputWithoutUsers = {
          ...sampleCreateChallengeInput,
          invitedUsers: undefined,
        };
        mockChallengeModel.createChallenge.mockResolvedValue(sampleChallenge);
        mockChallengeModel.createParticipants.mockResolvedValue([]);

        const result = await challengeService.createChallenge(inputWithoutUsers);

        expect(mockChallengeModel.createParticipants).toHaveBeenCalledWith({
          challengeId: 'test-challenge-id',
          participants: [],
        });
        expect(result.invitedCount).toBe(0);
      });

      it('should handle challenge creation with empty invited users array', async () => {
        const inputWithEmptyUsers = {
          ...sampleCreateChallengeInput,
          invitedUsers: [],
        };
        mockChallengeModel.createChallenge.mockResolvedValue(sampleChallenge);
        mockChallengeModel.createParticipants.mockResolvedValue([]);

        const result = await challengeService.createChallenge(inputWithEmptyUsers);

        expect(mockChallengeModel.createParticipants).toHaveBeenCalledWith({
          challengeId: 'test-challenge-id',
          participants: [],
        });
        expect(result.invitedCount).toBe(0);
      });

      it('should handle single invited user', async () => {
        const inputWithSingleUser = {
          ...sampleCreateChallengeInput,
          invitedUsers: ['single@example.com'],
        };
        const singleParticipant = [{ ...sampleParticipants[0], username: 'single@example.com' }];

        mockChallengeModel.createChallenge.mockResolvedValue(sampleChallenge);
        mockChallengeModel.createParticipants.mockResolvedValue(singleParticipant);

        const result = await challengeService.createChallenge(inputWithSingleUser);

        expect(mockChallengeModel.createParticipants).toHaveBeenCalledWith({
          challengeId: 'test-challenge-id',
          participants: ['single@example.com'],
        });
        expect(result.invitedCount).toBe(1);
      });
    });

    describe('Error Propagation from Model Layer', () => {
      it('should propagate challenge creation errors', async () => {
        const creationError = new ConflictError('Challenge name already exists');
        mockChallengeModel.createChallenge.mockRejectedValue(creationError);

        await expect(challengeService.createChallenge(sampleCreateChallengeInput)).rejects.toThrow(
          ConflictError,
        );
        await expect(challengeService.createChallenge(sampleCreateChallengeInput)).rejects.toThrow(
          'Challenge name already exists',
        );

        expect(mockChallengeModel.createParticipants).not.toHaveBeenCalled();
      });

      it('should propagate participant creation errors', async () => {
        const participantError = new Error('Invalid user reference');
        mockChallengeModel.createChallenge.mockResolvedValue(sampleChallenge);
        mockChallengeModel.createParticipants.mockRejectedValue(participantError);

        await expect(challengeService.createChallenge(sampleCreateChallengeInput)).rejects.toThrow(
          'Invalid user reference',
        );

        expect(mockChallengeModel.createChallenge).toHaveBeenCalledTimes(1);
        expect(mockChallengeModel.createParticipants).toHaveBeenCalledTimes(1);
      });

      it('should handle database constraint violations', async () => {
        const constraintError = new Error('Database constraint violation');
        mockChallengeModel.createChallenge.mockRejectedValue(constraintError);

        await expect(challengeService.createChallenge(sampleCreateChallengeInput)).rejects.toThrow(
          'Database constraint violation',
        );
      });

      it('should handle waypoint reference errors', async () => {
        const waypointError = new ConflictError('Invalid waypoint reference');
        mockChallengeModel.createChallenge.mockRejectedValue(waypointError);

        await expect(challengeService.createChallenge(sampleCreateChallengeInput)).rejects.toThrow(
          ConflictError,
        );
      });
    });
  });

  describe('updateChallenge', () => {
    describe('Happy Path', () => {
      it('should update challenge successfully', async () => {
        const updatedChallenge = {
          ...sampleChallenge,
          challenge_desc: 'Updated challenge description',
        };
        mockChallengeModel.challengeById.mockResolvedValue(sampleChallenge);
        mockChallengeModel.updateChallenge.mockResolvedValue(updatedChallenge);

        const result = await challengeService.updateChallenge(
          'test-challenge-id',
          sampleCreateChallengeInput,
        );

        expect(mockChallengeModel.challengeById).toHaveBeenCalledWith('test-challenge-id');
        expect(mockChallengeModel.updateChallenge).toHaveBeenCalledWith(
          'test-challenge-id',
          sampleCreateChallengeInput,
        );

        expect(mockChallengeEventBus.emitChallengeUpdated).toHaveBeenCalledWith({
          challengeId: 'test-challenge-id',
          startTime: sampleCreateChallengeInput.startTime,
          previousStartTime: sampleChallenge.start_time,
        });
        expect(result).toEqual(updatedChallenge);
      });

      it('should handle different challenge updates', async () => {
        const differentUpdate = {
          ...sampleCreateChallengeInput,
          challengeName: 'Different Adventure',
          duration: 180,
        };
        const updatedChallenge = {
          ...sampleChallenge,
          challenge_name: 'Different Adventure',
          duration: 180,
        };

        mockChallengeModel.updateChallenge.mockResolvedValue(updatedChallenge);

        const result = await challengeService.updateChallenge('test-challenge-id', differentUpdate);

        expect(mockChallengeModel.updateChallenge).toHaveBeenCalledWith(
          'test-challenge-id',
          differentUpdate,
        );
        expect(result).toEqual(updatedChallenge);
      });
    });

    describe('Error Propagation from Model Layer', () => {
      it('should propagate model update errors', async () => {
        const updateError = new Error('Update operation failed');
        mockChallengeModel.updateChallenge.mockRejectedValue(updateError);

        await expect(
          challengeService.updateChallenge('test-challenge-id', sampleCreateChallengeInput),
        ).rejects.toThrow('Update operation failed');
      });

      it('should handle NotFoundError from model layer', async () => {
        const notFoundError = new NotFoundError('Challenge not found for update');
        mockChallengeModel.updateChallenge.mockRejectedValue(notFoundError);

        await expect(
          challengeService.updateChallenge('nonexistent-challenge', sampleCreateChallengeInput),
        ).rejects.toThrow(NotFoundError);
        await expect(
          challengeService.updateChallenge('nonexistent-challenge', sampleCreateChallengeInput),
        ).rejects.toThrow('Challenge not found for update');
      });

      it('should handle constraint violations during update', async () => {
        const constraintError = new ConflictError('Constraint violation during update');
        mockChallengeModel.updateChallenge.mockRejectedValue(constraintError);

        await expect(
          challengeService.updateChallenge('test-challenge-id', sampleCreateChallengeInput),
        ).rejects.toThrow(ConflictError);
      });

      it('should handle database transaction failures', async () => {
        const transactionError = new Error('Transaction rollback failed');
        mockChallengeModel.updateChallenge.mockRejectedValue(transactionError);

        await expect(
          challengeService.updateChallenge('test-challenge-id', sampleCreateChallengeInput),
        ).rejects.toThrow('Transaction rollback failed');
      });
    });
  });

  describe('deleteChallenge', () => {
    describe('Happy Path', () => {
      it('should delete challenge and participants successfully', async () => {
        mockChallengeModel.deleteParticipants.mockResolvedValue(2);
        mockChallengeModel.deleteChallenge.mockResolvedValue();

        await challengeService.deleteChallenge('test-challenge-id');

        expect(mockChallengeModel.deleteParticipants).toHaveBeenCalledWith('test-challenge-id');
        expect(mockChallengeModel.deleteChallenge).toHaveBeenCalledWith('test-challenge-id');

        expect(mockChallengeEventBus.emitChallengeDeleted).toHaveBeenCalledWith({
          challengeId: 'test-challenge-id',
        });
      });

      it('should handle deletion when no participants exist', async () => {
        mockChallengeModel.deleteParticipants.mockResolvedValue(0);
        mockChallengeModel.deleteChallenge.mockResolvedValue();

        await challengeService.deleteChallenge('empty-challenge-id');

        expect(mockChallengeModel.deleteParticipants).toHaveBeenCalledWith('empty-challenge-id');
        expect(mockChallengeModel.deleteChallenge).toHaveBeenCalledWith('empty-challenge-id');
      });

      it('should handle successful deletion without return value', async () => {
        mockChallengeModel.deleteParticipants.mockResolvedValue(null);
        mockChallengeModel.deleteChallenge.mockResolvedValue(undefined);

        const result = await challengeService.deleteChallenge('test-challenge-id');

        expect(result).toBeUndefined();
        expect(mockChallengeModel.deleteParticipants).toHaveBeenCalledTimes(1);
        expect(mockChallengeModel.deleteChallenge).toHaveBeenCalledTimes(1);
      });
    });

    describe('Error Handling and Wrapped Errors', () => {
      it('should wrap deleteParticipants errors in AppError', async () => {
        const participantError = new Error('Failed to delete participants');
        mockChallengeModel.deleteParticipants.mockRejectedValue(participantError);

        await expect(challengeService.deleteChallenge('test-challenge-id')).rejects.toThrow(
          AppError,
        );
        await expect(challengeService.deleteChallenge('test-challenge-id')).rejects.toThrow(
          'Failed to cancel challenge [test-challenge-id: Failed to delete participants.',
        );

        expect(mockChallengeModel.deleteChallenge).not.toHaveBeenCalled();
      });

      it('should wrap deleteChallenge errors in AppError', async () => {
        const challengeError = new Error('Failed to delete challenge');
        mockChallengeModel.deleteParticipants.mockResolvedValue(1);
        mockChallengeModel.deleteChallenge.mockRejectedValue(challengeError);

        await expect(challengeService.deleteChallenge('test-challenge-id')).rejects.toThrow(
          AppError,
        );
        await expect(challengeService.deleteChallenge('test-challenge-id')).rejects.toThrow(
          'Failed to cancel challenge [test-challenge-id: Failed to delete challenge.',
        );
      });

      it('should handle constraint violation errors', async () => {
        const constraintError = new Error('Foreign key constraint violation');
        mockChallengeModel.deleteParticipants.mockRejectedValue(constraintError);

        await expect(challengeService.deleteChallenge('test-challenge-id')).rejects.toThrow(
          AppError,
        );

        // Verify error is logged
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        try {
          await challengeService.deleteChallenge('test-challenge-id').catch(() => {});
        } catch (error) {
          // Expected to throw
        }
        expect(consoleSpy).toHaveBeenCalledWith('Error: Foreign key constraint violation');
        consoleSpy.mockRestore();
      });

      it('should handle database timeout errors', async () => {
        const timeoutError = new Error('Query timeout exceeded');
        mockChallengeModel.deleteParticipants.mockResolvedValue(2);
        mockChallengeModel.deleteChallenge.mockRejectedValue(timeoutError);

        await expect(challengeService.deleteChallenge('test-challenge-id')).rejects.toThrow(
          AppError,
        );
      });

      it('should handle NotFoundError from deleteChallenge', async () => {
        const notFoundError = new Error('Challenge not found');
        mockChallengeModel.deleteParticipants.mockResolvedValue(0);
        mockChallengeModel.deleteChallenge.mockRejectedValue(notFoundError);

        await expect(challengeService.deleteChallenge('nonexistent-challenge')).rejects.toThrow(
          AppError,
        );
      });

      it('should preserve AppError status code (500)', async () => {
        const dbError = new Error('Database connection lost');
        mockChallengeModel.deleteParticipants.mockRejectedValue(dbError);

        try {
          await challengeService.deleteChallenge('test-challenge-id');
          fail('Expected AppError to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(AppError);
          expect((error as AppError).statusCode).toBe(500);
        }
      });
    });
  });

  describe('Service Instance Integration', () => {
    it('should maintain consistent behavior across multiple method calls', async () => {
      // Test service state consistency
      mockChallengeModel.challengeById.mockResolvedValue(sampleChallenge);

      const result1 = await challengeService.getChallenge('test-challenge-id');
      const result2 = await challengeService.getChallenge('test-challenge-id');

      expect(result1).toEqual(result2);
      expect(mockChallengeModel.challengeById).toHaveBeenCalledTimes(2);
    });

    it('should handle cascading operations correctly', async () => {
      // Test create followed by get
      mockChallengeModel.createChallenge.mockResolvedValue(sampleChallenge);
      mockChallengeModel.createParticipants.mockResolvedValue([]);
      mockChallengeModel.challengeById.mockResolvedValue(sampleChallenge);

      await challengeService.createChallenge(sampleCreateChallengeInput);
      const retrieved = await challengeService.getChallenge('test-challenge-id');

      expect(retrieved).toEqual(sampleChallenge);
    });

    it('should handle mixed success/failure scenarios gracefully', async () => {
      // Scenario: createChallenge succeeds, but createParticipants fails
      mockChallengeModel.createChallenge.mockResolvedValue(sampleChallenge);
      mockChallengeModel.createParticipants.mockRejectedValue(
        new Error('Participant creation failed'),
      );

      await expect(challengeService.createChallenge(sampleCreateChallengeInput)).rejects.toThrow(
        'Participant creation failed',
      );

      expect(mockChallengeModel.createChallenge).toHaveBeenCalledTimes(1);
      expect(mockChallengeModel.createParticipants).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Response Consistency', () => {
    it('should maintain error type consistency across methods', async () => {
      const dbError = new Error('Database unavailable');

      mockChallengeModel.challengeById.mockRejectedValue(dbError);
      mockChallengeModel.findAllParticipantsByChallengeId.mockRejectedValue(dbError);
      mockChallengeModel.updateChallenge.mockRejectedValue(dbError);

      await expect(challengeService.getChallenge('test-id')).rejects.toThrow(
        'Database unavailable',
      );
      await expect(challengeService.getParticipantsByChallengeId('test-id')).rejects.toThrow(
        'Database unavailable',
      );
      await expect(
        challengeService.updateChallenge('test-id', sampleCreateChallengeInput),
      ).rejects.toThrow('Database unavailable');
    });

    it('should handle undefined/null edge cases consistently', async () => {
      mockChallengeModel.challengeById.mockResolvedValue(undefined);
      mockChallengeModel.findAllParticipantsByChallengeId.mockResolvedValue([]);

      await expect(challengeService.getChallenge('undefined-challenge')).rejects.toThrow(
        NotFoundError,
      );

      const emptyResult = await challengeService.getParticipantsByChallengeId('empty-challenge');
      expect(emptyResult).toEqual([]);
    });
  });
});
