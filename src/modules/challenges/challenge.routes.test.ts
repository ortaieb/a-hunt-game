import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { config } from '../../config';
import { challengeService } from './challenge.service';
import { UserModel } from '../users/user.model';
import { ConflictError, NotFoundError, AppError } from '../../shared/types/errors';

// Mock challengeService - focusing on routes behavior
jest.mock('./challenge.service');
// Mock UserModel for authentication
jest.mock('../users/user.model');

const mockedChallengeService = challengeService as jest.Mocked<typeof challengeService>;
const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe('Challenge Routes', () => {
  const mockAdminToken = jwt.sign(
    {
      upn: 'admin@example.com',
      nickname: 'Admin User',
      roles: ['game.admin'],
      iss: 'scavenger-hunt-game',
    },
    config.jwt.secret,
    { expiresIn: '1h' },
  );

  const mockPlayerToken = jwt.sign(
    {
      upn: 'player@example.com',
      nickname: 'Player User',
      roles: ['game.player'],
      iss: 'scavenger-hunt-game',
    },
    config.jwt.secret,
    { expiresIn: '1h' },
  );

  const mockChallenge = {
    challenge_id: 'test-challenge-id',
    challenge_name: 'Adventure Hunt',
    challenge_desc: 'A thrilling adventure challenge',
    waypoints: 'central-park-waypoints',
    start_time: new Date('2024-01-15T10:00:00Z'),
    duration: 120,
  };

  const mockParticipant = {
    challenge_participant_id: 'participant-1',
    challenge_id: 'test-challenge-id',
    username: 'user1@example.com',
    participant_name: 'User One',
    state: 'PENDING' as const,
    valid_from: new Date('2024-01-01T00:00:00Z'),
    valid_until: null,
  };

  const mockCreateChallengeInput = {
    challengeName: 'Adventure Hunt',
    challengeDesc: 'A thrilling adventure challenge',
    waypointsRef: 'central-park-waypoints',
    startTime: '2024-01-15T10:00:00Z',
    duration: 120,
    invitedUsers: ['user1@example.com', 'user2@example.com'],
  };

  const mockChallengeParticipantsInput = {
    challengeId: '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
    participants: ['user1@example.com', 'user2@example.com'],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock UserModel for authentication
    mockedUserModel.findByUsername.mockResolvedValue({
      user_id: 'admin-user-id',
      username: 'admin@example.com',
      password_hash: 'hashed-password',
      nickname: 'Admin User',
      roles: ['game.admin'],
      valid_from: new Date(),
      valid_until: null,
    });
  });

  describe('GET /', () => {
    describe('Happy Path', () => {
      it('should return all active challenges for admin user', async () => {
        const mockChallenges = [mockChallenge, { ...mockChallenge, challenge_id: 'challenge-2' }];
        mockedChallengeService.activeChallenges.mockResolvedValue(mockChallenges);

        const response = await request(app)
          .get('/hunt/manager/challenges')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
          mockChallenges.map((challenge) => ({
            ...challenge,
            start_time: challenge.start_time.toISOString(),
          })),
        );
        expect(mockedChallengeService.activeChallenges).toHaveBeenCalledTimes(1);
      });

      it('should return empty array when no challenges exist', async () => {
        mockedChallengeService.activeChallenges.mockResolvedValue([]);

        const response = await request(app)
          .get('/hunt/manager/challenges')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });
    });

    describe('Authorization', () => {
      it('should return 401 for missing token', async () => {
        const response = await request(app).get('/hunt/manager/challenges');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
          error: 'request did not include token',
        });
        expect(mockedChallengeService.activeChallenges).not.toHaveBeenCalled();
      });

      it('should return 403 for non-admin user', async () => {
        const response = await request(app)
          .get('/hunt/manager/challenges')
          .set('user-auth-token', mockPlayerToken);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'insufficient permissions' });
        expect(mockedChallengeService.activeChallenges).not.toHaveBeenCalled();
      });

      it('should return 401 for invalid token', async () => {
        const response = await request(app)
          .get('/hunt/manager/challenges')
          .set('user-auth-token', 'invalid-token');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
          error: 'request carries the wrong token',
        });
      });
    });

    describe('Service Layer Errors', () => {
      it('should return 500 for service layer database error', async () => {
        mockedChallengeService.activeChallenges.mockRejectedValue(
          new Error('Database connection failed'),
        );

        const response = await request(app)
          .get('/hunt/manager/challenges')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Internal server error' });
      });
    });
  });

  describe('GET /:challengeId', () => {
    describe('Happy Path', () => {
      it('should return specific challenge for admin user', async () => {
        mockedChallengeService.getChallenge.mockResolvedValue(mockChallenge);

        const response = await request(app)
          .get('/hunt/manager/challenges/test-challenge-id')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          ...mockChallenge,
          start_time: mockChallenge.start_time.toISOString(),
        });
        expect(mockedChallengeService.getChallenge).toHaveBeenCalledWith('test-challenge-id');
      });
    });

    describe('Error Cases', () => {
      it('should return 404 when challenge not found', async () => {
        mockedChallengeService.getChallenge.mockRejectedValue(
          new NotFoundError('Challenge not found'),
        );

        const response = await request(app)
          .get('/hunt/manager/challenges/nonexistent-challenge')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'Challenge not found' });
      });

      it('should return 500 for service layer error', async () => {
        mockedChallengeService.getChallenge.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/hunt/manager/challenges/test-challenge-id')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Internal server error' });
      });
    });

    describe('Authorization', () => {
      it('should return 401 for missing token', async () => {
        const response = await request(app).get('/hunt/manager/challenges/test-challenge-id');

        expect(response.status).toBe(401);
        expect(mockedChallengeService.getChallenge).not.toHaveBeenCalled();
      });

      it('should return 403 for non-admin user', async () => {
        const response = await request(app)
          .get('/hunt/manager/challenges/test-challenge-id')
          .set('user-auth-token', mockPlayerToken);

        expect(response.status).toBe(403);
        expect(mockedChallengeService.getChallenge).not.toHaveBeenCalled();
      });
    });
  });

  describe('POST /', () => {
    describe('Happy Path', () => {
      it('should create new challenge successfully', async () => {
        const createdChallenge = { ...mockChallenge, invitedCount: 2 };
        mockedChallengeService.createChallenge.mockResolvedValue(createdChallenge);

        const response = await request(app)
          .post('/hunt/manager/challenges')
          .set('user-auth-token', mockAdminToken)
          .send(mockCreateChallengeInput);

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
          ...createdChallenge,
          start_time: createdChallenge.start_time.toISOString(),
        });
        expect(mockedChallengeService.createChallenge).toHaveBeenCalledWith(
          expect.objectContaining({
            challengeName: 'Adventure Hunt',
            challengeDesc: 'A thrilling adventure challenge',
            waypointsRef: 'central-park-waypoints',
            duration: 120,
            invitedUsers: ['user1@example.com', 'user2@example.com'],
          }),
        );
      });

      it('should handle challenge creation with kebab-case input', async () => {
        const kebabCaseInput = {
          'challenge-name': 'Adventure Hunt',
          'challenge-desc': 'A thrilling adventure challenge',
          'waypoints-ref': 'central-park-waypoints',
          'start-time': '2024-01-15T10:00:00Z',
          duration: 120,
          'invited-users': ['user1@example.com'],
        };

        const createdChallenge = { ...mockChallenge, invitedCount: 1 };
        mockedChallengeService.createChallenge.mockResolvedValue(createdChallenge);

        const response = await request(app)
          .post('/hunt/manager/challenges')
          .set('user-auth-token', mockAdminToken)
          .send(kebabCaseInput);

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
          ...createdChallenge,
          start_time: createdChallenge.start_time.toISOString(),
        });
      });
    });

    describe('Validation Errors', () => {
      it('should return 400 for missing required fields', async () => {
        const invalidInput = {
          challengeName: 'Test', // Too short
          // Missing required fields
        };

        const response = await request(app)
          .post('/hunt/manager/challenges')
          .set('user-auth-token', mockAdminToken)
          .send(invalidInput);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
        expect(mockedChallengeService.createChallenge).not.toHaveBeenCalled();
      });

      it('should return 400 for invalid challenge name length', async () => {
        const invalidInput = {
          ...mockCreateChallengeInput,
          challengeName: 'AB', // Too short (< 3 characters)
        };

        const response = await request(app)
          .post('/hunt/manager/challenges')
          .set('user-auth-token', mockAdminToken)
          .send(invalidInput);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });

      it('should return 400 for negative duration', async () => {
        const invalidInput = {
          ...mockCreateChallengeInput,
          duration: -10, // Negative duration
        };

        const response = await request(app)
          .post('/hunt/manager/challenges')
          .set('user-auth-token', mockAdminToken)
          .send(invalidInput);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });

      it('should return 400 for invalid email format in invited users', async () => {
        const invalidInput = {
          ...mockCreateChallengeInput,
          invitedUsers: ['invalid-email', 'another-invalid'],
        };

        const response = await request(app)
          .post('/hunt/manager/challenges')
          .set('user-auth-token', mockAdminToken)
          .send(invalidInput);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('Service Layer Errors', () => {
      it('should return 409 for duplicate challenge name', async () => {
        mockedChallengeService.createChallenge.mockRejectedValue(
          new ConflictError('Challenge already exists'),
        );

        const response = await request(app)
          .post('/hunt/manager/challenges')
          .set('user-auth-token', mockAdminToken)
          .send(mockCreateChallengeInput);

        expect(response.status).toBe(409);
        expect(response.body).toEqual({ error: 'Challenge already exists' });
      });

      it('should return 500 for service layer database error', async () => {
        mockedChallengeService.createChallenge.mockRejectedValue(
          new Error('Database constraint violation'),
        );

        const response = await request(app)
          .post('/hunt/manager/challenges')
          .set('user-auth-token', mockAdminToken)
          .send(mockCreateChallengeInput);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Internal server error' });
      });
    });

    describe('Authorization', () => {
      it('should return 401 for missing token', async () => {
        const response = await request(app)
          .post('/hunt/manager/challenges')
          .send(mockCreateChallengeInput);

        expect(response.status).toBe(401);
        expect(mockedChallengeService.createChallenge).not.toHaveBeenCalled();
      });

      it('should return 403 for non-admin user', async () => {
        const response = await request(app)
          .post('/hunt/manager/challenges')
          .set('user-auth-token', mockPlayerToken)
          .send(mockCreateChallengeInput);

        expect(response.status).toBe(403);
        expect(mockedChallengeService.createChallenge).not.toHaveBeenCalled();
      });
    });
  });

  describe('POST /:challengeId', () => {
    describe('Happy Path', () => {
      it('should update existing challenge successfully', async () => {
        const updatedChallenge = {
          ...mockChallenge,
          challenge_desc: 'Updated description',
        };
        mockedChallengeService.updateChallenge.mockResolvedValue(updatedChallenge);

        const response = await request(app)
          .post('/hunt/manager/challenges/test-challenge-id')
          .set('user-auth-token', mockAdminToken)
          .send(mockCreateChallengeInput);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          ...updatedChallenge,
          start_time: updatedChallenge.start_time.toISOString(),
        });
        expect(mockedChallengeService.updateChallenge).toHaveBeenCalledWith(
          'test-challenge-id',
          expect.objectContaining({
            challengeName: mockCreateChallengeInput.challengeName,
            challengeDesc: mockCreateChallengeInput.challengeDesc,
            waypointsRef: mockCreateChallengeInput.waypointsRef,
            startTime: expect.any(Date),
            duration: mockCreateChallengeInput.duration,
            participants: mockCreateChallengeInput.invitedUsers,
          }),
        );
      });
    });

    describe('Error Cases', () => {
      it('should return 404 when challenge not found for update', async () => {
        mockedChallengeService.updateChallenge.mockRejectedValue(
          new NotFoundError('Challenge not found'),
        );

        const response = await request(app)
          .post('/hunt/manager/challenges/nonexistent-challenge')
          .set('user-auth-token', mockAdminToken)
          .send(mockCreateChallengeInput);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'Challenge not found' });
      });
    });

    describe('Authorization', () => {
      it('should return 401 for missing token', async () => {
        const response = await request(app)
          .post('/hunt/manager/challenges/test-challenge-id')
          .send(mockCreateChallengeInput);

        expect(response.status).toBe(401);
        expect(mockedChallengeService.updateChallenge).not.toHaveBeenCalled();
      });

      it('should return 403 for non-admin user', async () => {
        const response = await request(app)
          .post('/hunt/manager/challenges/test-challenge-id')
          .set('user-auth-token', mockPlayerToken)
          .send(mockCreateChallengeInput);

        expect(response.status).toBe(403);
        expect(mockedChallengeService.updateChallenge).not.toHaveBeenCalled();
      });
    });
  });

  describe('GET /:challengeId/participants', () => {
    describe('Happy Path', () => {
      it('should return all participants for a challenge', async () => {
        const mockParticipants = [
          mockParticipant,
          { ...mockParticipant, challenge_participant_id: 'participant-2' },
        ];
        mockedChallengeService.getParticipantsByChallengeId.mockResolvedValue(mockParticipants);

        const response = await request(app)
          .get('/hunt/manager/challenges/test-challenge-id/participants')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
          mockParticipants.map((participant) => ({
            ...participant,
            valid_from: participant.valid_from.toISOString(),
          })),
        );
        expect(mockedChallengeService.getParticipantsByChallengeId).toHaveBeenCalledWith(
          'test-challenge-id',
        );
      });

      it('should return empty array when no participants found', async () => {
        mockedChallengeService.getParticipantsByChallengeId.mockResolvedValue([]);

        const response = await request(app)
          .get('/hunt/manager/challenges/test-challenge-id/participants')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });
    });

    describe('Error Cases', () => {
      it('should return 500 for service layer error', async () => {
        mockedChallengeService.getParticipantsByChallengeId.mockRejectedValue(
          new Error('Database error'),
        );

        const response = await request(app)
          .get('/hunt/manager/challenges/test-challenge-id/participants')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Internal server error' });
      });
    });

    describe('Authorization', () => {
      it('should return 403 for non-admin user', async () => {
        const response = await request(app)
          .get('/hunt/manager/challenges/test-challenge-id/participants')
          .set('user-auth-token', mockPlayerToken);

        expect(response.status).toBe(403);
        expect(mockedChallengeService.getParticipantsByChallengeId).not.toHaveBeenCalled();
      });
    });
  });

  describe('GET /:challengeId/participants/:participantId', () => {
    describe('Happy Path', () => {
      it('should return specific participant when found in correct challenge', async () => {
        mockedChallengeService.getParticipant.mockResolvedValue(mockParticipant);

        const response = await request(app)
          .get('/hunt/manager/challenges/test-challenge-id/participants/participant-1')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          ...mockParticipant,
          valid_from: mockParticipant.valid_from.toISOString(),
        });
        expect(mockedChallengeService.getParticipant).toHaveBeenCalledWith('participant-1');
      });
    });

    describe('Error Cases', () => {
      it('should return 404 when participant is in different challenge', async () => {
        const wrongChallengeParticipant = {
          ...mockParticipant,
          challenge_id: 'different-challenge-id',
        };
        mockedChallengeService.getParticipant.mockResolvedValue(wrongChallengeParticipant);

        const response = await request(app)
          .get('/hunt/manager/challenges/test-challenge-id/participants/participant-1')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
          error: 'Could not find participant participant-1 in challenge test-challenge-id',
        });
      });

      it('should return 200 with undefined when participant not found', async () => {
        mockedChallengeService.getParticipant.mockResolvedValue(null as any);

        const response = await request(app)
          .get('/hunt/manager/challenges/test-challenge-id/participants/nonexistent-participant')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(200);
        expect(response.body).toBeNull();
      });

      it('should return 500 for service layer error', async () => {
        mockedChallengeService.getParticipant.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/hunt/manager/challenges/test-challenge-id/participants/participant-1')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Internal server error' });
      });
    });
  });

  describe('GET /:challengeId/participants/byUser/:username', () => {
    describe('Happy Path', () => {
      it('should return participant by username for specific challenge', async () => {
        mockedChallengeService.getParticipantByChallengeAndUsername.mockResolvedValue(
          mockParticipant,
        );

        const response = await request(app)
          .get('/hunt/manager/challenges/test-challenge-id/participants/byUser/user1@example.com')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          ...mockParticipant,
          valid_from: mockParticipant.valid_from.toISOString(),
        });
        expect(mockedChallengeService.getParticipantByChallengeAndUsername).toHaveBeenCalledWith(
          'test-challenge-id',
          'user1@example.com',
        );
      });

      it('should return undefined when user is not a participant in the challenge', async () => {
        mockedChallengeService.getParticipantByChallengeAndUsername.mockResolvedValue(null as any);

        const response = await request(app)
          .get(
            '/hunt/manager/challenges/test-challenge-id/participants/byUser/nonparticipant@example.com',
          )
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(200);
        expect(response.body).toBeNull();
      });
    });

    describe('Error Cases', () => {
      it('should return 500 for service layer error', async () => {
        mockedChallengeService.getParticipantByChallengeAndUsername.mockRejectedValue(
          new Error('Database error'),
        );

        const response = await request(app)
          .get('/hunt/manager/challenges/test-challenge-id/participants/byUser/user1@example.com')
          .set('user-auth-token', mockAdminToken);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Internal server error' });
      });
    });

    describe('Authorization', () => {
      it('should return 403 for non-admin user', async () => {
        const response = await request(app)
          .get('/hunt/manager/challenges/test-challenge-id/participants/byUser/user1@example.com')
          .set('user-auth-token', mockPlayerToken);

        expect(response.status).toBe(403);
        expect(mockedChallengeService.getParticipantByChallengeAndUsername).not.toHaveBeenCalled();
      });
    });
  });

  describe('POST /:challengeId/inviteParticipants', () => {
    describe('Happy Path', () => {
      it('should invite participants to challenge successfully', async () => {
        const invitedParticipants = [
          mockParticipant,
          {
            ...mockParticipant,
            challenge_participant_id: 'participant-2',
            username: 'user2@example.com',
          },
        ];
        mockedChallengeService.inviteParticipants.mockResolvedValue(invitedParticipants);

        const response = await request(app)
          .post('/hunt/manager/challenges/test-challenge-id/inviteParticipants')
          .set('user-auth-token', mockAdminToken)
          .send(mockChallengeParticipantsInput);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
          invitedParticipants.map((participant) => ({
            ...participant,
            valid_from: participant.valid_from.toISOString(),
          })),
        );
        expect(mockedChallengeService.inviteParticipants).toHaveBeenCalledWith({
          challengeId: mockChallengeParticipantsInput.challengeId,
          participants: mockChallengeParticipantsInput.participants,
        });
      });

      it('should handle kebab-case input for invite participants', async () => {
        const kebabCaseInput = {
          'challenge-id': '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
          'invited-users': ['user1@example.com', 'user2@example.com'],
        };

        const invitedParticipants = [mockParticipant];
        mockedChallengeService.inviteParticipants.mockResolvedValue(invitedParticipants);

        const response = await request(app)
          .post('/hunt/manager/challenges/test-challenge-id/inviteParticipants')
          .set('user-auth-token', mockAdminToken)
          .send(kebabCaseInput);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
          invitedParticipants.map((participant) => ({
            ...participant,
            valid_from: participant.valid_from.toISOString(),
          })),
        );
      });
    });

    describe('Validation Errors', () => {
      it('should return 400 for missing challenge ID in body', async () => {
        const invalidInput = {
          participants: ['user1@example.com'],
          // Missing challengeId
        };

        const response = await request(app)
          .post('/hunt/manager/challenges/test-challenge-id/inviteParticipants')
          .set('user-auth-token', mockAdminToken)
          .send(invalidInput);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
        expect(mockedChallengeService.inviteParticipants).not.toHaveBeenCalled();
      });

      it('should return 400 for invalid challenge ID format', async () => {
        const invalidInput = {
          challengeId: '01234567-89ab-4def-8123-456789abcdef', // UUIDv4, not UUIDv7
          participants: ['user1@example.com'],
        };

        const response = await request(app)
          .post('/hunt/manager/challenges/test-challenge-id/inviteParticipants')
          .set('user-auth-token', mockAdminToken)
          .send(invalidInput);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });

      it('should return 400 for invalid email formats in invited users', async () => {
        const invalidInput = {
          challengeId: '01234567-89ab-7def-8123-456789abcdef', // UUIDv7 format
          participants: ['invalid-email', 'another-invalid'],
        };

        const response = await request(app)
          .post('/hunt/manager/challenges/test-challenge-id/inviteParticipants')
          .set('user-auth-token', mockAdminToken)
          .send(invalidInput);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('Service Layer Errors', () => {
      it('should return 409 for participant already exists', async () => {
        mockedChallengeService.inviteParticipants.mockRejectedValue(
          new ConflictError('Participant already exists'),
        );

        const response = await request(app)
          .post('/hunt/manager/challenges/test-challenge-id/inviteParticipants')
          .set('user-auth-token', mockAdminToken)
          .send(mockChallengeParticipantsInput);

        expect(response.status).toBe(409);
        expect(response.body).toEqual({ error: 'Participant already exists' });
      });

      it('should return 500 for service layer database error', async () => {
        mockedChallengeService.inviteParticipants.mockRejectedValue(
          new Error('Database constraint violation'),
        );

        const response = await request(app)
          .post('/hunt/manager/challenges/test-challenge-id/inviteParticipants')
          .set('user-auth-token', mockAdminToken)
          .send(mockChallengeParticipantsInput);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Internal server error' });
      });
    });

    describe('Authorization', () => {
      it('should return 401 for missing token', async () => {
        const response = await request(app)
          .post('/hunt/manager/challenges/test-challenge-id/inviteParticipants')
          .send(mockChallengeParticipantsInput);

        expect(response.status).toBe(401);
        expect(mockedChallengeService.inviteParticipants).not.toHaveBeenCalled();
      });

      it('should return 403 for non-admin user', async () => {
        const response = await request(app)
          .post('/hunt/manager/challenges/test-challenge-id/inviteParticipants')
          .set('user-auth-token', mockPlayerToken)
          .send(mockChallengeParticipantsInput);

        expect(response.status).toBe(403);
        expect(mockedChallengeService.inviteParticipants).not.toHaveBeenCalled();
      });
    });
  });

  describe('Route Integration', () => {
    it('should handle cascading operations correctly', async () => {
      // Test create challenge followed by get challenge
      const createdChallenge = { ...mockChallenge, invitedCount: 1 };
      mockedChallengeService.createChallenge.mockResolvedValue(createdChallenge);
      mockedChallengeService.getChallenge.mockResolvedValue(mockChallenge);

      // Create challenge
      const createResponse = await request(app)
        .post('/hunt/manager/challenges')
        .set('user-auth-token', mockAdminToken)
        .send(mockCreateChallengeInput);

      expect(createResponse.status).toBe(201);

      // Get challenge
      const getResponse = await request(app)
        .get('/hunt/manager/challenges/test-challenge-id')
        .set('user-auth-token', mockAdminToken);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toEqual({
        ...mockChallenge,
        start_time: mockChallenge.start_time.toISOString(),
      });
    });

    it('should maintain consistent error handling across endpoints', async () => {
      const dbError = new Error('Database unavailable');

      mockedChallengeService.activeChallenges.mockRejectedValue(dbError);
      mockedChallengeService.getChallenge.mockRejectedValue(dbError);
      mockedChallengeService.createChallenge.mockRejectedValue(dbError);

      const endpoints = [
        { method: 'get', path: '/hunt/manager/challenges' },
        { method: 'get', path: '/hunt/manager/challenges/test-id' },
        {
          method: 'post',
          path: '/hunt/manager/challenges',
          body: mockCreateChallengeInput,
        },
      ];

      for (const endpoint of endpoints) {
        let response;
        if (endpoint.method === 'get') {
          response = await request(app).get(endpoint.path).set('user-auth-token', mockAdminToken);
        } else {
          response = await request(app)
            .post(endpoint.path)
            .set('user-auth-token', mockAdminToken)
            .send(endpoint.body);
        }

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Internal server error' });
      }
    });
  });
});
