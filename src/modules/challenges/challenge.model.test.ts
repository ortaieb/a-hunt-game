import { ChallengeModel } from './challenge.model';
import { 
  CreateChallengeData, 
  Challenge, 
  ChallengeParticipant,
  ChallengeParticipantsData,
  UpdateChallengeParticipantDetails, 
} from './challenge.type';

// Mock the database module
jest.mock('../../shared/database', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
  },
}));

// Mock UUID v7 for deterministic tests
jest.mock('uuid', () => ({
  v7: jest.fn(() => 'test-uuid-v7'),
}));

// Import the mocked db after mocking
const mockDb = require('../../shared/database').db;

describe('ChallengeModel', () => {
  // Sample test data
  const sampleChallengeData: CreateChallengeData = {
    challengeName: 'Downtown Adventure Hunt',
    challengeDesc: 'An exciting scavenger hunt through downtown',
    waypointsRef: 'downtown-tour',
    startTime: new Date('2024-08-15T10:00:00Z'),
    duration: 90,
  };

  const sampleDbChallenge: Challenge = {
    challenge_id: 'test-challenge-id',
    challenge_inst_id: 'test-challenge-inst-id',
    challenge_name: 'Downtown Adventure Hunt',
    challenge_desc: 'An exciting scavenger hunt through downtown',
    waypoints: 'downtown-tour',
    start_time: new Date('2024-08-15T10:00:00Z'),
    duration: 90,
    valid_from: new Date('2024-08-01T00:00:00Z'),
    valid_until: null,
  };

  // Removed unused variable sampleChallengeResponse

  const sampleChallengeParticipant: ChallengeParticipant = {
    challenge_participant_id: 'test-participant-id',
    challenge_participant_inst_id: 'test-participant-inst-id',
    challenge_id: 'test-challenge-id',
    user_name: 'user@example.com',
    participant_name: 'John Doe',
    state: 'ACCEPTED',
    valid_from: new Date('2024-08-01T00:00:00Z'),
    valid_until: null,
  };

  const sampleParticipantsData: ChallengeParticipantsData = {
    challengeId: 'test-challenge-id',
    participants: ['user1@example.com', 'user2@example.com'],
  };

  const sampleUpdateParticipantData: UpdateChallengeParticipantDetails = {
    challengeId: 'test-challenge-id',
    participantId: 'test-participant-id',
    state: 'ACCEPTED',
    participantName: 'John Doe Updated',
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('challengeById', () => {
    describe('Happy Path', () => {
      it('should return challenge when found', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([sampleDbChallenge]),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act
        const result = await ChallengeModel.challengeById(challengeId);

        // Assert
        expect(result).toEqual(sampleDbChallenge);
        expect(mockDb.select).toHaveBeenCalledTimes(1);
        expect(mockQuery.from).toHaveBeenCalledWith(expect.any(Object)); // challenges table
        expect(mockQuery.where).toHaveBeenCalledWith(expect.any(Object)); // AND condition
        expect(mockQuery.limit).toHaveBeenCalledWith(1);
      });

      it('should return undefined when challenge not found', async () => {
        // Arrange
        const challengeId = 'non-existent-id';
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act
        const result = await ChallengeModel.challengeById(challengeId);

        // Assert
        expect(result).toBeUndefined();
        expect(mockDb.select).toHaveBeenCalledTimes(1);
      });

      it('should filter out soft-deleted challenges', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act
        const result = await ChallengeModel.challengeById(challengeId);

        // Assert
        expect(result).toBeUndefined();
        expect(mockQuery.where).toHaveBeenCalledWith(expect.any(Object)); // Should include isNull(valid_until)
      });
    });

    describe('Database Errors', () => {
      it('should throw error when database query fails', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const databaseError = new Error('Database connection failed');
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockRejectedValue(databaseError),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(ChallengeModel.challengeById(challengeId)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should throw error when invalid challenge ID provided', async () => {
        // Arrange
        const invalidChallengeId = '';
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockRejectedValue(new Error('Invalid UUID format')),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(ChallengeModel.challengeById(invalidChallengeId)).rejects.toThrow();
      });
    });
  });

  describe('createChallenge', () => {
    describe('Happy Path', () => {
      it('should create and return a new challenge', async () => {
        // Arrange
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([sampleDbChallenge]),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act
        const result = await ChallengeModel.createChallenge(sampleChallengeData);

        // Assert
        expect(result).toEqual(sampleDbChallenge);
        expect(mockDb.insert).toHaveBeenCalledWith(expect.any(Object)); // challenges table
        expect(mockQuery.values).toHaveBeenCalledWith({
          challenge_id: 'test-uuid-v7',
          challenge_inst_id: 'test-uuid-v7',
          challenge_name: sampleChallengeData.challengeName,
          challenge_desc: sampleChallengeData.challengeDesc,
          waypoints: sampleChallengeData.waypointsRef,
          start_time: sampleChallengeData.startTime,
          duration: sampleChallengeData.duration,
          valid_from: expect.any(Date),
          valid_until: null,
        });
        expect(mockQuery.returning).toHaveBeenCalledTimes(1);
      });

      it('should generate UUID v7 for challenge IDs', async () => {
        // Arrange
        const mockUuid = require('uuid');
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([sampleDbChallenge]),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act
        await ChallengeModel.createChallenge(sampleChallengeData);

        // Assert
        expect(mockUuid.v7).toHaveBeenCalledTimes(2); // challenge_id and challenge_inst_id
      });

      it('should set valid_from to current date and valid_until to null', async () => {
        // Arrange
        const beforeTime = new Date();
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([sampleDbChallenge]),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act
        await ChallengeModel.createChallenge(sampleChallengeData);
        const afterTime = new Date();

        // Assert
        const calledValues = mockQuery.values.mock.calls[0][0];
        expect(calledValues.valid_from).toBeInstanceOf(Date);
        expect(calledValues.valid_from.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(calledValues.valid_from.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        expect(calledValues.valid_until).toBeNull();
      });
    });

    describe('Invalid Input', () => {
      it('should handle missing required fields gracefully', async () => {
        // Arrange
        const invalidData = {
          challengeName: '',
          challengeDesc: 'Valid description',
          waypointsRef: 'valid-waypoints',
          startTime: new Date(),
          duration: 60,
        } as CreateChallengeData;

        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockRejectedValue(new Error('NOT NULL constraint violated')),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(ChallengeModel.createChallenge(invalidData)).rejects.toThrow();
      });

      it('should handle invalid duration values', async () => {
        // Arrange
        const invalidData = {
          ...sampleChallengeData,
          duration: -10, // Invalid negative duration
        };

        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockRejectedValue(new Error('CHECK constraint violated')),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(ChallengeModel.createChallenge(invalidData)).rejects.toThrow();
      });

      it('should handle invalid waypoint reference', async () => {
        // Arrange
        const invalidData = {
          ...sampleChallengeData,
          waypointsRef: 'non-existent-waypoint',
        };

        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockRejectedValue(new Error('FOREIGN KEY constraint violated')),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(ChallengeModel.createChallenge(invalidData)).rejects.toThrow(
          'FOREIGN KEY constraint violated',
        );
      });
    });

    describe('Database Errors', () => {
      it('should throw error when insert fails', async () => {
        // Arrange
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([]), // Empty result
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(ChallengeModel.createChallenge(sampleChallengeData)).rejects.toThrow(
          'Failed to create Challenge record',
        );
      });

      it('should throw error when database connection fails', async () => {
        // Arrange
        const databaseError = new Error('Database connection failed');
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockRejectedValue(databaseError),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(ChallengeModel.createChallenge(sampleChallengeData)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should handle database constraint violations', async () => {
        // Arrange
        const constraintError = new Error('duplicate key value violates unique constraint');
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockRejectedValue(constraintError),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(ChallengeModel.createChallenge(sampleChallengeData)).rejects.toThrow(
          'duplicate key value violates unique constraint',
        );
      });
    });
  });

  describe('updateChallenge', () => {
    describe('Happy Path', () => {
      it('should update challenge using temporal pattern', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const updatedData = {
          ...sampleChallengeData,
          challengeName: 'Updated Adventure Hunt',
        };

        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue({ rowCount: 1 }),
        };

        const mockInsert = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{
            ...sampleDbChallenge,
            challenge_name: 'Updated Adventure Hunt',
            challenge_inst_id: 'test-uuid-v7',
          }]),
        };

        const mockTransaction = jest.fn().mockImplementation((callback) => {
          const tx = {
            update: jest.fn().mockReturnValue(mockUpdate),
            insert: jest.fn().mockReturnValue(mockInsert),
          };
          return callback(tx);
        });

        mockDb.transaction.mockImplementation(mockTransaction);

        // Act
        const result = await ChallengeModel.updateChallenge(challengeId, updatedData);

        // Assert
        expect(result.challenge_name).toBe('Updated Adventure Hunt');
        expect(mockDb.transaction).toHaveBeenCalledTimes(1);
        expect(mockUpdate.set).toHaveBeenCalledWith({ valid_until: expect.any(Date) });
        expect(mockUpdate.where).toHaveBeenCalledWith(expect.any(Object));
        expect(mockInsert.values).toHaveBeenCalledWith({
          challenge_id: challengeId,
          challenge_inst_id: 'test-uuid-v7',
          challenge_name: updatedData.challengeName,
          challenge_desc: updatedData.challengeDesc,
          waypoints: updatedData.waypointsRef,
          start_time: updatedData.startTime,
          duration: updatedData.duration,
          valid_from: expect.any(Date),
          valid_until: null,
        });
      });

      it('should preserve the original challenge_id during update', async () => {
        // Arrange
        const challengeId = 'original-challenge-id';
        const mockTransaction = jest.fn().mockImplementation((callback) => {
          const tx = {
            update: jest.fn().mockReturnValue({
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockResolvedValue({ rowCount: 1 }),
            }),
            insert: jest.fn().mockReturnValue({
              values: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([{
                ...sampleDbChallenge,
                challenge_id: challengeId,
              }]),
            }),
          };
          return callback(tx);
        });
        mockDb.transaction.mockImplementation(mockTransaction);

        // Act
        const result = await ChallengeModel.updateChallenge(challengeId, sampleChallengeData);

        // Assert
        expect(result.challenge_id).toBe(challengeId);
      });

      it('should generate new challenge_inst_id for each update', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const mockUuid = require('uuid');
        mockUuid.v7.mockReturnValueOnce('new-inst-id');

        const mockTransaction = jest.fn().mockImplementation((callback) => {
          const tx = {
            update: jest.fn().mockReturnValue({
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockResolvedValue({ rowCount: 1 }),
            }),
            insert: jest.fn().mockReturnValue({
              values: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([{
                ...sampleDbChallenge,
                challenge_inst_id: 'new-inst-id',
              }]),
            }),
          };
          return callback(tx);
        });
        mockDb.transaction.mockImplementation(mockTransaction);

        // Act
        const result = await ChallengeModel.updateChallenge(challengeId, sampleChallengeData);

        // Assert
        expect((result as any).challenge_inst_id).toBe('new-inst-id');
        expect(mockUuid.v7).toHaveBeenCalledTimes(1);
      });
    });

    describe('Invalid Input', () => {
      it('should handle invalid challenge ID', async () => {
        // Arrange
        const invalidChallengeId = 'non-existent-id';
        const mockTransaction = jest.fn().mockImplementation((callback) => {
          const tx = {
            update: jest.fn().mockReturnValue({
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockResolvedValue({ rowCount: 0 }), // No rows affected
            }),
            insert: jest.fn().mockReturnValue({
              values: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([]),
            }),
          };
          return callback(tx);
        });
        mockDb.transaction.mockImplementation(mockTransaction);

        // Act & Assert
        await expect(
          ChallengeModel.updateChallenge(invalidChallengeId, sampleChallengeData),
        ).rejects.toThrow('Failed to update user');
      });

      it('should handle invalid waypoint reference during update', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const invalidData = {
          ...sampleChallengeData,
          waypointsRef: 'non-existent-waypoint',
        };

        const mockTransaction = jest.fn().mockImplementation((callback) => {
          const tx = {
            update: jest.fn().mockReturnValue({
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockResolvedValue({ rowCount: 1 }),
            }),
            insert: jest.fn().mockReturnValue({
              values: jest.fn().mockReturnThis(),
              returning: jest.fn().mockRejectedValue(new Error('FOREIGN KEY constraint violated')),
            }),
          };
          return callback(tx);
        });
        mockDb.transaction.mockImplementation(mockTransaction);

        // Act & Assert
        await expect(ChallengeModel.updateChallenge(challengeId, invalidData)).rejects.toThrow(
          'FOREIGN KEY constraint violated',
        );
      });
    });

    describe('Database Errors', () => {
      it('should rollback transaction when update fails', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const updateError = new Error('Update operation failed');
        const mockTransaction = jest.fn().mockRejectedValue(updateError);
        mockDb.transaction.mockImplementation(mockTransaction);

        // Act & Assert
        await expect(
          ChallengeModel.updateChallenge(challengeId, sampleChallengeData),
        ).rejects.toThrow('Update operation failed');
      });

      it('should rollback transaction when insert fails', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const mockTransaction = jest.fn().mockImplementation((callback) => {
          const tx = {
            update: jest.fn().mockReturnValue({
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockResolvedValue({ rowCount: 1 }),
            }),
            insert: jest.fn().mockReturnValue({
              values: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([]), // Empty result
            }),
          };
          return callback(tx);
        });
        mockDb.transaction.mockImplementation(mockTransaction);

        // Act & Assert
        await expect(
          ChallengeModel.updateChallenge(challengeId, sampleChallengeData),
        ).rejects.toThrow('Failed to update user');
      });

      it('should handle database connection failures during transaction', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const connectionError = new Error('Database connection lost');
        mockDb.transaction.mockRejectedValue(connectionError);

        // Act & Assert
        await expect(
          ChallengeModel.updateChallenge(challengeId, sampleChallengeData),
        ).rejects.toThrow('Database connection lost');
      });
    });
  });

  describe('deleteChallenge', () => {
    describe('Happy Path', () => {
      it('should soft delete challenge by setting valid_until', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const beforeTime = new Date();
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue({ rowCount: 1 }),
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act
        await ChallengeModel.deleteChallenge(challengeId);
        const afterTime = new Date();

        // Assert
        expect(mockDb.update).toHaveBeenCalledWith(expect.any(Object)); // challenges table
        expect(mockUpdate.set).toHaveBeenCalledWith({ valid_until: expect.any(Date) });
        
        const setCallArgs = mockUpdate.set.mock.calls[0][0];
        expect(setCallArgs.valid_until).toBeInstanceOf(Date);
        expect(setCallArgs.valid_until.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(setCallArgs.valid_until.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        
        expect(mockUpdate.where).toHaveBeenCalledWith(expect.any(Object)); // AND condition with isNull
      });

      it('should only delete active challenges (where valid_until is null)', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue({ rowCount: 1 }),
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act
        await ChallengeModel.deleteChallenge(challengeId);

        // Assert
        expect(mockUpdate.where).toHaveBeenCalledWith(expect.any(Object)); // Should include isNull(valid_until)
      });
    });

    describe('Invalid Input', () => {
      it('should throw error when challenge not found', async () => {
        // Arrange
        const nonExistentId = 'non-existent-id';
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue({ rowCount: 0 }), // No rows affected
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act & Assert
        await expect(ChallengeModel.deleteChallenge(nonExistentId)).rejects.toThrow(
          'Challenge with id [${challengeId}] was not found',
        );
      });

      it('should not delete already soft-deleted challenges', async () => {
        // Arrange
        const challengeId = 'already-deleted-challenge';
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue({ rowCount: 0 }), // No active challenge found
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act & Assert
        await expect(ChallengeModel.deleteChallenge(challengeId)).rejects.toThrow(
          'Challenge with id [${challengeId}] was not found',
        );
      });

      it('should handle empty or invalid challenge ID', async () => {
        // Arrange
        const invalidId = '';
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockRejectedValue(new Error('Invalid UUID format')),
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act & Assert
        await expect(ChallengeModel.deleteChallenge(invalidId)).rejects.toThrow();
      });
    });

    describe('Database Errors', () => {
      it('should throw error when database update fails', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const databaseError = new Error('Database connection failed');
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockRejectedValue(databaseError),
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act & Assert
        await expect(ChallengeModel.deleteChallenge(challengeId)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should handle constraint violations during delete', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const constraintError = new Error('Cannot delete: foreign key constraint violation');
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockRejectedValue(constraintError),
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act & Assert
        await expect(ChallengeModel.deleteChallenge(challengeId)).rejects.toThrow(
          'Cannot delete: foreign key constraint violation',
        );
      });

      it('should handle database timeout during delete operation', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const timeoutError = new Error('Query timeout exceeded');
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockRejectedValue(timeoutError),
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act & Assert
        await expect(ChallengeModel.deleteChallenge(challengeId)).rejects.toThrow(
          'Query timeout exceeded',
        );
      });
    });
  });

  describe('findByParticipantId', () => {
    describe('Happy Path', () => {
      it('should return participant when found', async () => {
        // Arrange
        const participantId = 'test-participant-id';
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([sampleChallengeParticipant]),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act
        const result = await ChallengeModel.findByParticipantId(participantId);

        // Assert
        expect(result).toEqual(sampleChallengeParticipant);
        expect(mockDb.select).toHaveBeenCalledTimes(1);
        expect(mockQuery.from).toHaveBeenCalledWith(expect.any(Object)); // challengeParticipants table
        expect(mockQuery.where).toHaveBeenCalledWith(expect.any(Object)); // AND condition
        expect(mockQuery.limit).toHaveBeenCalledWith(1);
      });

      it('should return undefined when participant not found', async () => {
        // Arrange
        const participantId = 'non-existent-participant';
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act
        const result = await ChallengeModel.findByParticipantId(participantId);

        // Assert
        expect(result).toBeUndefined();
        expect(mockDb.select).toHaveBeenCalledTimes(1);
      });

      it('should filter out soft-deleted participants', async () => {
        // Arrange
        const participantId = 'test-participant-id';
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act
        const result = await ChallengeModel.findByParticipantId(participantId);

        // Assert
        expect(result).toBeUndefined();
        expect(mockQuery.where).toHaveBeenCalledWith(expect.any(Object)); // Should include isNull(valid_until)
      });
    });

    describe('Database Errors', () => {
      it('should throw error when database query fails', async () => {
        // Arrange
        const participantId = 'test-participant-id';
        const databaseError = new Error('Database connection failed');
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockRejectedValue(databaseError),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(ChallengeModel.findByParticipantId(participantId)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should throw error when invalid participant ID provided', async () => {
        // Arrange
        const invalidParticipantId = '';
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockRejectedValue(new Error('Invalid UUID format')),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(ChallengeModel.findByParticipantId(invalidParticipantId)).rejects.toThrow();
      });
    });
  });

  describe('findAllParticipantsByChallengeId', () => {
    describe('Happy Path', () => {
      it('should return all active participants for a challenge', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const participants = [
          sampleChallengeParticipant,
          {
            ...sampleChallengeParticipant,
            challenge_participant_id: 'test-participant-id-2',
            user_name: 'user2@example.com',
          },
        ];
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue(participants),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act
        const result = await ChallengeModel.findAllParticipantsByChallengeId(challengeId);

        // Assert
        expect(result).toEqual(participants);
        expect(result).toHaveLength(2);
        expect(mockDb.select).toHaveBeenCalledTimes(1);
        expect(mockQuery.from).toHaveBeenCalledWith(expect.any(Object)); // challengeParticipants table
        expect(mockQuery.where).toHaveBeenCalledWith(expect.any(Object)); // AND condition
      });

      it('should return empty array when no participants found', async () => {
        // Arrange
        const challengeId = 'challenge-with-no-participants';
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act
        const result = await ChallengeModel.findAllParticipantsByChallengeId(challengeId);

        // Assert
        expect(result).toEqual([]);
        expect(mockDb.select).toHaveBeenCalledTimes(1);
      });

      it('should only return active participants (filter soft-deleted)', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([sampleChallengeParticipant]),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act
        const result = await ChallengeModel.findAllParticipantsByChallengeId(challengeId);

        // Assert
        expect(result).toHaveLength(1);
        expect(mockQuery.where).toHaveBeenCalledWith(expect.any(Object)); // Should include isNull(valid_until)
      });
    });

    describe('Database Errors', () => {
      it('should throw error when database query fails', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const databaseError = new Error('Database connection failed');
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockRejectedValue(databaseError),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(
          ChallengeModel.findAllParticipantsByChallengeId(challengeId),
        ).rejects.toThrow('Database connection failed');
      });

      it('should throw error when invalid challenge ID provided', async () => {
        // Arrange
        const invalidChallengeId = '';
        const mockQuery = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockRejectedValue(new Error('Invalid UUID format')),
        };
        mockDb.select.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(
          ChallengeModel.findAllParticipantsByChallengeId(invalidChallengeId),
        ).rejects.toThrow();
      });
    });
  });

  describe('createParticipants', () => {
    describe('Happy Path', () => {
      it('should create multiple participants and return them', async () => {
        // Arrange
        const expectedParticipants = [
          {
            ...sampleChallengeParticipant,
            user_name: 'user1@example.com',
            participant_name: '',
            state: 'PENDING',
          },
          {
            ...sampleChallengeParticipant,
            challenge_participant_id: 'test-uuid-v7-2',
            user_name: 'user2@example.com',
            participant_name: '',
            state: 'PENDING',
          },
        ];
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue(expectedParticipants),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act
        const result = await ChallengeModel.createParticipants(sampleParticipantsData);

        // Assert
        expect(result).toEqual(expectedParticipants);
        expect(mockDb.insert).toHaveBeenCalledWith(expect.any(Object)); // challengeParticipants table
        expect(mockQuery.values).toHaveBeenCalledWith([
          {
            challenge_participant_id: 'test-uuid-v7',
            challenge_participant_inst_id: 'test-uuid-v7',
            challenge_id: 'test-challenge-id',
            user_name: 'user1@example.com',
            participant_name: '',
            state: 'PENDING',
            valid_from: expect.any(Date),
            valid_until: null,
          },
          {
            challenge_participant_id: 'test-uuid-v7',
            challenge_participant_inst_id: 'test-uuid-v7',
            challenge_id: 'test-challenge-id',
            user_name: 'user2@example.com',
            participant_name: '',
            state: 'PENDING',
            valid_from: expect.any(Date),
            valid_until: null,
          },
        ]);
        expect(mockQuery.returning).toHaveBeenCalledTimes(1);
      });

      it('should generate UUID v7 for each participant', async () => {
        // Arrange
        const mockUuid = require('uuid');
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([sampleChallengeParticipant]),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act
        await ChallengeModel.createParticipants(sampleParticipantsData);

        // Assert
        expect(mockUuid.v7).toHaveBeenCalledTimes(4); // 2 participants * 2 UUIDs each
      });

      it('should set all participants to PENDING state initially', async () => {
        // Arrange
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([sampleChallengeParticipant]),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act
        await ChallengeModel.createParticipants(sampleParticipantsData);

        // Assert
        const calledValues = mockQuery.values.mock.calls[0][0];
        calledValues.forEach((participant: any) => {
          expect(participant.state).toBe('PENDING');
          expect(participant.participant_name).toBe('');
          expect(participant.valid_from).toBeInstanceOf(Date);
          expect(participant.valid_until).toBeNull();
        });
      });

      it('should handle single participant creation', async () => {
        // Arrange
        const singleParticipantData = {
          challengeId: 'test-challenge-id',
          participants: ['user1@example.com'],
        };
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([sampleChallengeParticipant]),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act
        const result = await ChallengeModel.createParticipants(singleParticipantData);

        // Assert
        expect(result).toHaveLength(1);
        const calledValues = mockQuery.values.mock.calls[0][0];
        expect(calledValues).toHaveLength(1);
        expect(calledValues[0].user_name).toBe('user1@example.com');
      });
    });

    describe('Invalid Input', () => {
      it('should handle empty participants array', async () => {
        // Arrange
        const emptyData = {
          challengeId: 'test-challenge-id',
          participants: [],
        };
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([]),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act
        const result = await ChallengeModel.createParticipants(emptyData);

        // Assert
        expect(result).toEqual([]);
        const calledValues = mockQuery.values.mock.calls[0][0];
        expect(calledValues).toHaveLength(0);
      });

      it('should handle invalid challenge ID', async () => {
        // Arrange
        const invalidData = {
          challengeId: 'non-existent-challenge',
          participants: ['user1@example.com'],
        };
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockRejectedValue(new Error('FOREIGN KEY constraint violated')),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(ChallengeModel.createParticipants(invalidData)).rejects.toThrow(
          'FOREIGN KEY constraint violated',
        );
      });

      it('should handle invalid user names', async () => {
        // Arrange
        const invalidData = {
          challengeId: 'test-challenge-id',
          participants: ['non-existent-user@example.com'],
        };
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockRejectedValue(new Error('FOREIGN KEY constraint violated')),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(ChallengeModel.createParticipants(invalidData)).rejects.toThrow(
          'FOREIGN KEY constraint violated',
        );
      });
    });

    describe('Database Errors', () => {
      it('should throw error when database insert fails', async () => {
        // Arrange
        const databaseError = new Error('Database connection failed');
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockRejectedValue(databaseError),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(ChallengeModel.createParticipants(sampleParticipantsData)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should handle duplicate participant creation', async () => {
        // Arrange
        const duplicateError = new Error('duplicate key value violates unique constraint');
        const mockQuery = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockRejectedValue(duplicateError),
        };
        mockDb.insert.mockReturnValue(mockQuery);

        // Act & Assert
        await expect(ChallengeModel.createParticipants(sampleParticipantsData)).rejects.toThrow(
          'duplicate key value violates unique constraint',
        );
      });
    });
  });

  describe('updateParticipantDetails', () => {
    describe('Happy Path', () => {
      it('should update participant details using temporal pattern', async () => {
        // Arrange
        const updatedParticipant = {
          ...sampleChallengeParticipant,
          participant_name: 'John Doe Updated',
          state: 'ACCEPTED',
          challenge_participant_inst_id: 'new-inst-id',
        };

        const mockSelect = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([sampleChallengeParticipant]),
        };

        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue({ rowCount: 1 }),
        };

        const mockInsert = {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([updatedParticipant]),
        };

        const mockTransaction = jest.fn().mockImplementation((callback) => {
          const tx = {
            select: jest.fn().mockReturnValue(mockSelect),
            update: jest.fn().mockReturnValue(mockUpdate),
            insert: jest.fn().mockReturnValue(mockInsert),
          };
          return callback(tx);
        });

        mockDb.transaction.mockImplementation(mockTransaction);

        // Act
        const result = await ChallengeModel.updateParticipantDetails(sampleUpdateParticipantData);

        // Assert
        expect(result.participant_name).toBe('John Doe Updated');
        expect(result.state).toBe('ACCEPTED');
        expect(mockDb.transaction).toHaveBeenCalledTimes(1);
        expect(mockSelect.limit).toHaveBeenCalledWith(1);
        expect(mockUpdate.set).toHaveBeenCalledWith({ valid_until: expect.any(Date) });
        expect(mockInsert.values).toHaveBeenCalledWith({
          challenge_participant_id: sampleChallengeParticipant.challenge_participant_id,
          challenge_participant_inst_id: 'test-uuid-v7',
          challenge_id: sampleChallengeParticipant.challenge_id,
          user_name: sampleChallengeParticipant.user_name,
          participant_name: 'John Doe Updated',
          state: 'ACCEPTED',
          valid_from: expect.any(Date),
          valid_until: null,
        });
      });

      it('should preserve unchanged fields during update', async () => {
        // Arrange
        const partialUpdateData = {
          challengeId: 'test-challenge-id',
          participantId: 'test-participant-id',
          state: 'REJECTED' as const,
        };

        const mockTransaction = jest.fn().mockImplementation((callback) => {
          const tx = {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue([sampleChallengeParticipant]),
            }),
            update: jest.fn().mockReturnValue({
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockResolvedValue({ rowCount: 1 }),
            }),
            insert: jest.fn().mockReturnValue({
              values: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([{
                ...sampleChallengeParticipant,
                state: 'REJECTED',
              }]),
            }),
          };
          return callback(tx);
        });

        mockDb.transaction.mockImplementation(mockTransaction);

        // Act
        const result = await ChallengeModel.updateParticipantDetails(partialUpdateData);

        // Assert
        expect(result.state).toBe('REJECTED');
        expect(result.participant_name).toBe('John Doe'); // Should preserve original name
      });

      it('should generate new challenge_participant_inst_id for each update', async () => {
        // Arrange
        const mockUuid = require('uuid');
        mockUuid.v7.mockReturnValueOnce('new-inst-id');

        const mockTransaction = jest.fn().mockImplementation((callback) => {
          const tx = {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue([sampleChallengeParticipant]),
            }),
            update: jest.fn().mockReturnValue({
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockResolvedValue({ rowCount: 1 }),
            }),
            insert: jest.fn().mockReturnValue({
              values: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([{
                ...sampleChallengeParticipant,
                challenge_participant_inst_id: 'new-inst-id',
              }]),
            }),
          };
          return callback(tx);
        });

        mockDb.transaction.mockImplementation(mockTransaction);

        // Act
        const result = await ChallengeModel.updateParticipantDetails(sampleUpdateParticipantData);

        // Assert
        expect((result as any).challenge_participant_inst_id).toBe('new-inst-id');
        expect(mockUuid.v7).toHaveBeenCalledTimes(1);
      });
    });

    describe('Invalid Input', () => {
      it('should throw error when participant not found', async () => {
        // Arrange
        const mockTransaction = jest.fn().mockImplementation((callback) => {
          const tx = {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue([]), // No participant found
            }),
          };
          return callback(tx);
        });

        mockDb.transaction.mockImplementation(mockTransaction);

        // Act & Assert
        await expect(
          ChallengeModel.updateParticipantDetails(sampleUpdateParticipantData),
        ).rejects.toThrow(
          'Participant record ${updateStateData.participantId} @ {updateStateData.challengeId} not found',
        );
      });

      it('should handle invalid participant state', async () => {
        // Arrange
        const invalidData = {
          ...sampleUpdateParticipantData,
          state: 'INVALID_STATE' as any,
        };

        const mockTransaction = jest.fn().mockImplementation((callback) => {
          const tx = {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue([sampleChallengeParticipant]),
            }),
            update: jest.fn().mockReturnValue({
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockResolvedValue({ rowCount: 1 }),
            }),
            insert: jest.fn().mockReturnValue({
              values: jest.fn().mockReturnThis(),
              returning: jest.fn().mockRejectedValue(new Error('invalid input value for enum')),
            }),
          };
          return callback(tx);
        });

        mockDb.transaction.mockImplementation(mockTransaction);

        // Act & Assert
        await expect(
          ChallengeModel.updateParticipantDetails(invalidData),
        ).rejects.toThrow('invalid input value for enum');
      });
    });

    describe('Database Errors', () => {
      it('should rollback transaction when update fails', async () => {
        // Arrange
        const updateError = new Error('Update operation failed');
        const mockTransaction = jest.fn().mockRejectedValue(updateError);
        mockDb.transaction.mockImplementation(mockTransaction);

        // Act & Assert
        await expect(
          ChallengeModel.updateParticipantDetails(sampleUpdateParticipantData),
        ).rejects.toThrow('Update operation failed');
      });

      it('should rollback transaction when insert fails', async () => {
        // Arrange
        const mockTransaction = jest.fn().mockImplementation((callback) => {
          const tx = {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue([sampleChallengeParticipant]),
            }),
            update: jest.fn().mockReturnValue({
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockResolvedValue({ rowCount: 1 }),
            }),
            insert: jest.fn().mockReturnValue({
              values: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([]), // Empty result
            }),
          };
          return callback(tx);
        });

        mockDb.transaction.mockImplementation(mockTransaction);

        // Act & Assert
        await expect(
          ChallengeModel.updateParticipantDetails(sampleUpdateParticipantData),
        ).rejects.toThrow(
          'Failed to update Participant record ${updateStateData.participantId} @ {updateStateData.challengeId}',
        );
      });

      it('should handle database connection failures during transaction', async () => {
        // Arrange
        const connectionError = new Error('Database connection lost');
        mockDb.transaction.mockRejectedValue(connectionError);

        // Act & Assert
        await expect(
          ChallengeModel.updateParticipantDetails(sampleUpdateParticipantData),
        ).rejects.toThrow('Database connection lost');
      });
    });
  });

  describe('deleteParticipants', () => {
    describe('Happy Path', () => {
      it('should soft delete all participants of a challenge', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const beforeTime = new Date();
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue({ rowCount: 2 }), // 2 participants deleted
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act
        const result = await ChallengeModel.deleteParticipants(challengeId);
        const afterTime = new Date();

        // Assert
        expect(result).toBe(2);
        expect(mockDb.update).toHaveBeenCalledWith(expect.any(Object)); // challengeParticipants table
        expect(mockUpdate.set).toHaveBeenCalledWith({ valid_until: expect.any(Date) });
        
        const setCallArgs = mockUpdate.set.mock.calls[0][0];
        expect(setCallArgs.valid_until).toBeInstanceOf(Date);
        expect(setCallArgs.valid_until.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(setCallArgs.valid_until.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        
        expect(mockUpdate.where).toHaveBeenCalledWith(expect.any(Object)); // AND condition
      });

      it('should return number of deleted participants', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue({ rowCount: 5 }),
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act
        const result = await ChallengeModel.deleteParticipants(challengeId);

        // Assert
        expect(result).toBe(5);
      });

      it('should only delete active participants (where valid_until is null)', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue({ rowCount: 1 }),
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act
        await ChallengeModel.deleteParticipants(challengeId);

        // Assert
        expect(mockUpdate.where).toHaveBeenCalledWith(expect.any(Object)); // Should include isNull condition
      });
    });

    describe('Invalid Input', () => {
      it('should throw error when challenge not found or has no participants', async () => {
        // Arrange
        const nonExistentId = 'non-existent-challenge';
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue({ rowCount: 0 }), // No rows affected
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act & Assert
        await expect(ChallengeModel.deleteParticipants(nonExistentId)).rejects.toThrow(
          'Challenge with id [${challengeId}] was not found',
        );
      });

      it('should not delete already soft-deleted participants', async () => {
        // Arrange
        const challengeId = 'challenge-with-deleted-participants';
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue({ rowCount: 0 }), // No active participants found
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act & Assert
        await expect(ChallengeModel.deleteParticipants(challengeId)).rejects.toThrow(
          'Challenge with id [${challengeId}] was not found',
        );
      });

      it('should handle empty or invalid challenge ID', async () => {
        // Arrange
        const invalidId = '';
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockRejectedValue(new Error('Invalid UUID format')),
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act & Assert
        await expect(ChallengeModel.deleteParticipants(invalidId)).rejects.toThrow();
      });
    });

    describe('Database Errors', () => {
      it('should throw error when database update fails', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const databaseError = new Error('Database connection failed');
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockRejectedValue(databaseError),
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act & Assert
        await expect(ChallengeModel.deleteParticipants(challengeId)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should handle constraint violations during participant delete', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const constraintError = new Error('Cannot delete: foreign key constraint violation');
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockRejectedValue(constraintError),
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act & Assert
        await expect(ChallengeModel.deleteParticipants(challengeId)).rejects.toThrow(
          'Cannot delete: foreign key constraint violation',
        );
      });

      it('should handle database timeout during delete operation', async () => {
        // Arrange
        const challengeId = 'test-challenge-id';
        const timeoutError = new Error('Query timeout exceeded');
        const mockUpdate = {
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockRejectedValue(timeoutError),
        };
        mockDb.update.mockReturnValue(mockUpdate);

        // Act & Assert
        await expect(ChallengeModel.deleteParticipants(challengeId)).rejects.toThrow(
          'Query timeout exceeded',
        );
      });
    });
  });
});