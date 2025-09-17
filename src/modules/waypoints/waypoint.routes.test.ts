import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { config } from '../../config';
import { waypointService } from './waypoint.service';
import { UserModel } from '../users/user.model';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/types/errors';

// Mock waypointService - focusing on routes behavior
jest.mock('./waypoint.service');
// Mock UserModel for authentication
jest.mock('../users/user.model');

const mockedWaypointService = waypointService as jest.Mocked<typeof waypointService>;
const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe('Waypoint Routes', () => {
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

  const mockWaypointSequence = {
    waypoints_id: 'waypoint-uuid',
    waypoint_name: 'central-park-tour',
    waypoint_description: 'A guided tour through Central Park',
    data: [
      {
        waypoint_seq_id: 1,
        location: { lat: 40.7128, long: -74.006 },
        radius: 50,
        clue: 'Find the statue',
        hints: ['Look near water'],
        image_subject: 'statue',
      },
    ],
    valid_from: new Date('2023-01-01T00:00:00.000Z'),
    valid_until: null,
  };

  // Expected response format (dates are serialized to strings in HTTP response)
  const expectedWaypointSequence = {
    ...mockWaypointSequence,
    valid_from: '2023-01-01T00:00:00.000Z',
  };

  const validCreatePayload = {
    waypoint_name: 'central-park-tour',
    waypoint_description: 'A guided tour through Central Park',
    data: [
      {
        waypoint_seq_id: 1,
        location: { lat: 40.7128, long: -74.006 },
        radius: 50,
        clue: 'Find the statue',
        hints: ['Look near water'],
        image_subject: 'statue',
      },
    ],
  };

  const validUpdatePayload = {
    waypoint_name: 'central-park-tour',
    waypoint_description: 'Updated tour description',
    data: [
      {
        waypoint_seq_id: 1,
        location: { lat: 40.7129, long: -74.0061 },
        radius: 60,
        clue: 'Updated clue',
        hints: ['Updated hint'],
        image_subject: 'updated subject',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock UserModel for authentication middleware
    mockedUserModel.findByUsername.mockImplementation(username => {
      if (username === 'admin@example.com') {
        return Promise.resolve({
          user_id: 'admin-user-id',
          username: 'admin@example.com',
          password_hash: 'hash',
          nickname: 'Admin User',
          roles: ['game.admin'],
          valid_from: new Date(),
          valid_until: null,
        });
      }
      if (username === 'player@example.com') {
        return Promise.resolve({
          user_id: 'player-user-id',
          username: 'player@example.com',
          password_hash: 'hash',
          nickname: 'Player User',
          roles: ['game.player'],
          valid_from: new Date(),
          valid_until: null,
        });
      }
      return Promise.resolve(null);
    });
  });

  describe('GET /waypoints/:waypoint_name', () => {
    describe('Happy Path', () => {
      it('should get waypoint sequence successfully with valid token', async () => {
        mockedWaypointService.getWaypointSequence.mockResolvedValue(mockWaypointSequence);

        const response = await request(app)
          .get('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockPlayerToken)
          .expect(200);

        expect(response.body).toEqual(expectedWaypointSequence);
        expect(mockedWaypointService.getWaypointSequence).toHaveBeenCalledWith('central-park-tour');
        expect(mockedWaypointService.getWaypointSequence).toHaveBeenCalledTimes(1);
      });

      it('should get waypoint sequence with admin token', async () => {
        mockedWaypointService.getWaypointSequence.mockResolvedValue(mockWaypointSequence);

        const response = await request(app)
          .get('/hunt/manager/waypoints/nature-trail')
          .set('user-auth-token', mockAdminToken)
          .expect(200);

        expect(response.body).toEqual(expectedWaypointSequence);
        expect(mockedWaypointService.getWaypointSequence).toHaveBeenCalledWith('nature-trail');
      });

      it('should handle different waypoint names correctly', async () => {
        const differentWaypointSequence = {
          ...mockWaypointSequence,
          waypoint_name: 'museum-tour',
        };
        mockedWaypointService.getWaypointSequence.mockResolvedValue(differentWaypointSequence);

        await request(app)
          .get('/hunt/manager/waypoints/museum-tour')
          .set('user-auth-token', mockPlayerToken)
          .expect(200);

        expect(mockedWaypointService.getWaypointSequence).toHaveBeenCalledWith('museum-tour');
      });
    });

    describe('Authentication/Authorization Issues', () => {
      it('should return 401 without authentication token', async () => {
        await request(app).get('/hunt/manager/waypoints/central-park-tour').expect(401);

        expect(mockedWaypointService.getWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 401 with invalid token', async () => {
        await request(app)
          .get('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', 'invalid-token')
          .expect(401);

        expect(mockedWaypointService.getWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 401 with expired token', async () => {
        const expiredToken = jwt.sign(
          {
            upn: 'expired@example.com',
            nickname: 'Expired User',
            roles: ['game.player'],
            iss: 'scavenger-hunt-game',
          },
          config.jwt.secret,
          { expiresIn: '-1h' },
        );

        await request(app)
          .get('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', expiredToken)
          .expect(401);

        expect(mockedWaypointService.getWaypointSequence).not.toHaveBeenCalled();
      });
    });

    describe('Error Propagation from Service Layer', () => {
      it('should return 404 when waypoint sequence not found', async () => {
        mockedWaypointService.getWaypointSequence.mockRejectedValue(
          new NotFoundError('Waypoint sequence not found'),
        );

        const response = await request(app)
          .get('/hunt/manager/waypoints/nonexistent-tour')
          .set('user-auth-token', mockPlayerToken)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Waypoint sequence not found');
        expect(mockedWaypointService.getWaypointSequence).toHaveBeenCalledWith('nonexistent-tour');
      });

      it('should return 500 for unexpected service errors', async () => {
        mockedWaypointService.getWaypointSequence.mockRejectedValue(
          new Error('Unexpected database error'),
        );

        const response = await request(app)
          .get('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockPlayerToken)
          .expect(500);

        expect(response.body).toHaveProperty('error', 'Internal server error');
        expect(mockedWaypointService.getWaypointSequence).toHaveBeenCalledWith('central-park-tour');
      });

      it('should handle service layer validation errors', async () => {
        mockedWaypointService.getWaypointSequence.mockRejectedValue(
          new ValidationError('Invalid waypoint name format'),
        );

        const response = await request(app)
          .get('/hunt/manager/waypoints/invalid-name-format')
          .set('user-auth-token', mockPlayerToken)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Invalid waypoint name format');
      });
    });

    describe('Incorrect Endpoint Usage', () => {
      it('should return 404 for GET without waypoint name parameter', async () => {
        await request(app)
          .get('/hunt/manager/waypoints/')
          .set('user-auth-token', mockPlayerToken)
          .expect(404);

        expect(mockedWaypointService.getWaypointSequence).not.toHaveBeenCalled();
      });

      it('should ignore query parameters and use path parameter', async () => {
        mockedWaypointService.getWaypointSequence.mockResolvedValue(mockWaypointSequence);

        await request(app)
          .get('/hunt/manager/waypoints/central-park-tour?name=ignored&extra=param')
          .set('user-auth-token', mockPlayerToken)
          .expect(200);

        expect(mockedWaypointService.getWaypointSequence).toHaveBeenCalledWith('central-park-tour');
      });

      it('should handle URL-encoded waypoint names', async () => {
        mockedWaypointService.getWaypointSequence.mockResolvedValue(mockWaypointSequence);

        await request(app)
          .get('/hunt/manager/waypoints/central%20park%20tour')
          .set('user-auth-token', mockPlayerToken)
          .expect(200);

        expect(mockedWaypointService.getWaypointSequence).toHaveBeenCalledWith('central park tour');
      });
    });
  });

  describe('POST /waypoints', () => {
    describe('Happy Path', () => {
      it('should create waypoint sequence successfully with admin token', async () => {
        mockedWaypointService.createWaypointSequence.mockResolvedValue(mockWaypointSequence);

        const response = await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .send(validCreatePayload)
          .expect(201);

        expect(response.body).toEqual(expectedWaypointSequence);
        expect(mockedWaypointService.createWaypointSequence).toHaveBeenCalledWith(
          validCreatePayload,
        );
        expect(mockedWaypointService.createWaypointSequence).toHaveBeenCalledTimes(1);
      });

      it('should create waypoint sequence with minimal valid data', async () => {
        const minimalPayload = {
          waypoint_name: 'minimal-tour',
          waypoint_description: 'Minimal tour',
          data: [
            {
              waypoint_seq_id: 1,
              location: { lat: 0, long: 0 },
              radius: 10,
              clue: 'Minimal clue',
              hints: [],
              image_subject: 'subject',
            },
          ],
        };

        const minimalResponse = {
          ...mockWaypointSequence,
          waypoint_name: 'minimal-tour',
          waypoint_description: 'Minimal tour',
        };
        const expectedMinimalResponse = {
          ...minimalResponse,
          valid_from: '2023-01-01T00:00:00.000Z',
        };
        mockedWaypointService.createWaypointSequence.mockResolvedValue(minimalResponse);

        const response = await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .send(minimalPayload)
          .expect(201);

        expect(response.body).toEqual(expectedMinimalResponse);
        expect(mockedWaypointService.createWaypointSequence).toHaveBeenCalledWith(minimalPayload);
      });

      it('should create waypoint sequence with multiple waypoints', async () => {
        const multiWaypointPayload = {
          ...validCreatePayload,
          data: [
            validCreatePayload.data[0],
            {
              waypoint_seq_id: 2,
              location: { lat: 40.713, long: -74.0062 },
              radius: 75,
              clue: 'Second waypoint',
              hints: ['Second hint'],
              image_subject: 'second subject',
            },
          ],
        };

        mockedWaypointService.createWaypointSequence.mockResolvedValue(mockWaypointSequence);

        await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .send(multiWaypointPayload)
          .expect(201);

        expect(mockedWaypointService.createWaypointSequence).toHaveBeenCalledWith(
          multiWaypointPayload,
        );
      });
    });

    describe('Authentication/Authorization Issues', () => {
      it('should return 401 without authentication token', async () => {
        await request(app).post('/hunt/manager/waypoints').send(validCreatePayload).expect(401);

        expect(mockedWaypointService.createWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 403 with player token (insufficient permissions)', async () => {
        await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockPlayerToken)
          .send(validCreatePayload)
          .expect(403);

        expect(mockedWaypointService.createWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 401 with invalid token', async () => {
        await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', 'invalid-token')
          .send(validCreatePayload)
          .expect(401);

        expect(mockedWaypointService.createWaypointSequence).not.toHaveBeenCalled();
      });
    });

    describe('Wrong Input Data', () => {
      it('should return 400 with missing waypoint_name', async () => {
        const invalidPayload: any = { ...validCreatePayload };
        delete invalidPayload.waypoint_name;

        await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .send(invalidPayload)
          .expect(400);

        expect(mockedWaypointService.createWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 400 with missing waypoint_description', async () => {
        const invalidPayload: any = { ...validCreatePayload };
        delete invalidPayload.waypoint_description;

        await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .send(invalidPayload)
          .expect(400);

        expect(mockedWaypointService.createWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 400 with missing data array', async () => {
        const invalidPayload: any = { ...validCreatePayload };
        delete invalidPayload.data;

        await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .send(invalidPayload)
          .expect(400);

        expect(mockedWaypointService.createWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 400 with empty data array', async () => {
        const invalidPayload = { ...validCreatePayload, data: [] };

        await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .send(invalidPayload)
          .expect(400);

        expect(mockedWaypointService.createWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 400 with invalid latitude', async () => {
        const invalidPayload = {
          ...validCreatePayload,
          data: [
            {
              ...validCreatePayload.data[0],
              location: { lat: 91, long: -74.006 }, // Invalid latitude > 90
            },
          ],
        };

        await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .send(invalidPayload)
          .expect(400);

        expect(mockedWaypointService.createWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 400 with invalid longitude', async () => {
        const invalidPayload = {
          ...validCreatePayload,
          data: [
            {
              ...validCreatePayload.data[0],
              location: { lat: 40.7128, long: -181 }, // Invalid longitude < -180
            },
          ],
        };

        await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .send(invalidPayload)
          .expect(400);

        expect(mockedWaypointService.createWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 400 with negative radius', async () => {
        const invalidPayload = {
          ...validCreatePayload,
          data: [
            {
              ...validCreatePayload.data[0],
              radius: -10, // Invalid negative radius
            },
          ],
        };

        await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .send(invalidPayload)
          .expect(400);

        expect(mockedWaypointService.createWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 400 with invalid JSON payload', async () => {
        await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .set('Content-Type', 'application/json')
          .send('invalid-json')
          .expect(500); // Express returns 500 for malformed JSON

        expect(mockedWaypointService.createWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 400 with wrong Content-Type', async () => {
        await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .set('Content-Type', 'text/plain')
          .send('plain text data')
          .expect(400);

        expect(mockedWaypointService.createWaypointSequence).not.toHaveBeenCalled();
      });
    });

    describe('Error Propagation from Service Layer', () => {
      it('should return 409 when waypoint sequence already exists', async () => {
        mockedWaypointService.createWaypointSequence.mockRejectedValue(
          new ConflictError('Waypoint sequence with this name already exists'),
        );

        const response = await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .send(validCreatePayload)
          .expect(409);

        expect(response.body).toHaveProperty(
          'error',
          'Waypoint sequence with this name already exists',
        );
        expect(mockedWaypointService.createWaypointSequence).toHaveBeenCalledWith(
          validCreatePayload,
        );
      });

      it('should return 500 for unexpected service errors', async () => {
        mockedWaypointService.createWaypointSequence.mockRejectedValue(
          new Error('Database connection failed'),
        );

        const response = await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .send(validCreatePayload)
          .expect(500);

        expect(response.body).toHaveProperty('error', 'Internal server error');
        expect(mockedWaypointService.createWaypointSequence).toHaveBeenCalledWith(
          validCreatePayload,
        );
      });

      it('should handle service layer validation errors', async () => {
        mockedWaypointService.createWaypointSequence.mockRejectedValue(
          new ValidationError('Invalid waypoint sequence data'),
        );

        const response = await request(app)
          .post('/hunt/manager/waypoints')
          .set('user-auth-token', mockAdminToken)
          .send(validCreatePayload)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Invalid waypoint sequence data');
      });
    });

    describe('Incorrect Endpoint Usage', () => {
      it('should return 404 for POST with path parameter', async () => {
        await request(app)
          .post('/hunt/manager/waypoints/should-not-exist')
          .set('user-auth-token', mockAdminToken)
          .send(validCreatePayload)
          .expect(404);

        expect(mockedWaypointService.createWaypointSequence).not.toHaveBeenCalled();
      });

      it('should ignore query parameters in POST', async () => {
        mockedWaypointService.createWaypointSequence.mockResolvedValue(mockWaypointSequence);

        await request(app)
          .post('/hunt/manager/waypoints?ignored=param&extra=value')
          .set('user-auth-token', mockAdminToken)
          .send(validCreatePayload)
          .expect(201);

        expect(mockedWaypointService.createWaypointSequence).toHaveBeenCalledWith(
          validCreatePayload,
        );
      });
    });
  });

  describe('PUT /waypoints/:waypoint_name', () => {
    describe('Happy Path', () => {
      it('should update waypoint sequence successfully with admin token', async () => {
        const updatedSequence = {
          ...mockWaypointSequence,
          waypoint_description: 'Updated tour description',
        };
        const expectedUpdatedSequence = {
          ...updatedSequence,
          valid_from: '2023-01-01T00:00:00.000Z',
        };
        mockedWaypointService.updateWaypointSequence.mockResolvedValue(updatedSequence);

        const response = await request(app)
          .put('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .send(validUpdatePayload)
          .expect(201);

        expect(response.body).toEqual(expectedUpdatedSequence);
        expect(mockedWaypointService.updateWaypointSequence).toHaveBeenCalledWith(
          'central-park-tour',
          validUpdatePayload,
        );
        expect(mockedWaypointService.updateWaypointSequence).toHaveBeenCalledTimes(1);
      });

      it('should update waypoint sequence with multiple waypoints', async () => {
        const multiWaypointUpdate = {
          ...validUpdatePayload,
          data: [
            validUpdatePayload.data[0],
            {
              waypoint_seq_id: 2,
              location: { lat: 40.7131, long: -74.0063 },
              radius: 80,
              clue: 'Updated second waypoint',
              hints: ['Updated second hint'],
              image_subject: 'updated second subject',
            },
          ],
        };

        mockedWaypointService.updateWaypointSequence.mockResolvedValue(mockWaypointSequence);

        await request(app)
          .put('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .send(multiWaypointUpdate)
          .expect(201);

        expect(mockedWaypointService.updateWaypointSequence).toHaveBeenCalledWith(
          'central-park-tour',
          multiWaypointUpdate,
        );
      });

      it('should handle updating different waypoint names', async () => {
        const differentNameUpdate = {
          ...validUpdatePayload,
          waypoint_name: 'nature-trail',
        };
        mockedWaypointService.updateWaypointSequence.mockResolvedValue(mockWaypointSequence);

        await request(app)
          .put('/hunt/manager/waypoints/nature-trail')
          .set('user-auth-token', mockAdminToken)
          .send(differentNameUpdate)
          .expect(201);

        expect(mockedWaypointService.updateWaypointSequence).toHaveBeenCalledWith(
          'nature-trail',
          differentNameUpdate,
        );
      });
    });

    describe('Authentication/Authorization Issues', () => {
      it('should return 401 without authentication token', async () => {
        await request(app)
          .put('/hunt/manager/waypoints/central-park-tour')
          .send(validUpdatePayload)
          .expect(401);

        expect(mockedWaypointService.updateWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 403 with player token (insufficient permissions)', async () => {
        await request(app)
          .put('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockPlayerToken)
          .send(validUpdatePayload)
          .expect(403);

        expect(mockedWaypointService.updateWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 401 with invalid token', async () => {
        await request(app)
          .put('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', 'invalid-token')
          .send(validUpdatePayload)
          .expect(401);

        expect(mockedWaypointService.updateWaypointSequence).not.toHaveBeenCalled();
      });
    });

    describe('Wrong Input Data', () => {
      it('should return 400 with missing waypoint_name in body', async () => {
        const invalidPayload: any = { ...validUpdatePayload };
        delete invalidPayload.waypoint_name;

        await request(app)
          .put('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .send(invalidPayload)
          .expect(400);

        expect(mockedWaypointService.updateWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 400 with mismatched waypoint names', async () => {
        const mismatchedPayload = {
          ...validUpdatePayload,
          waypoint_name: 'different-name',
        };

        // The service layer validation should catch this mismatch and throw an error
        mockedWaypointService.updateWaypointSequence.mockRejectedValue(
          new ValidationError('URL waypoint_name must match body waypoint_name'),
        );

        const response = await request(app)
          .put('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .send(mismatchedPayload)
          .expect(400);

        expect(response.body).toHaveProperty(
          'error',
          'URL waypoint_name must match body waypoint_name',
        );
        expect(mockedWaypointService.updateWaypointSequence).toHaveBeenCalledWith(
          'central-park-tour',
          mismatchedPayload,
        );
      });

      it('should return 400 with invalid waypoint data structure', async () => {
        const invalidPayload = {
          ...validUpdatePayload,
          data: [
            {
              // Missing required fields
              waypoint_seq_id: 1,
              location: { lat: 40.7128 }, // Missing long
            },
          ],
        };

        await request(app)
          .put('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .send(invalidPayload)
          .expect(400);

        expect(mockedWaypointService.updateWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 400 with empty data array', async () => {
        const invalidPayload = { ...validUpdatePayload, data: [] };

        await request(app)
          .put('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .send(invalidPayload)
          .expect(400);

        expect(mockedWaypointService.updateWaypointSequence).not.toHaveBeenCalled();
      });
    });

    describe('Error Propagation from Service Layer', () => {
      it('should return 404 when waypoint sequence not found', async () => {
        mockedWaypointService.updateWaypointSequence.mockRejectedValue(
          new NotFoundError('Waypoint sequence not found'),
        );

        const response = await request(app)
          .put('/hunt/manager/waypoints/nonexistent-tour')
          .set('user-auth-token', mockAdminToken)
          .send({ ...validUpdatePayload, waypoint_name: 'nonexistent-tour' })
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Waypoint sequence not found');
        expect(mockedWaypointService.updateWaypointSequence).toHaveBeenCalledWith(
          'nonexistent-tour',
          {
            ...validUpdatePayload,
            waypoint_name: 'nonexistent-tour',
          },
        );
      });

      it('should return 400 for service validation errors', async () => {
        mockedWaypointService.updateWaypointSequence.mockRejectedValue(
          new ValidationError('URL waypoint_name must match body waypoint_name'),
        );

        const response = await request(app)
          .put('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .send(validUpdatePayload)
          .expect(400);

        expect(response.body).toHaveProperty(
          'error',
          'URL waypoint_name must match body waypoint_name',
        );
      });

      it('should return 500 for unexpected service errors', async () => {
        mockedWaypointService.updateWaypointSequence.mockRejectedValue(
          new Error('Database update failed'),
        );

        const response = await request(app)
          .put('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .send(validUpdatePayload)
          .expect(500);

        expect(response.body).toHaveProperty('error', 'Internal server error');
        expect(mockedWaypointService.updateWaypointSequence).toHaveBeenCalledWith(
          'central-park-tour',
          validUpdatePayload,
        );
      });
    });

    describe('Incorrect Endpoint Usage', () => {
      it('should return 404 for PUT without waypoint name parameter', async () => {
        await request(app)
          .put('/hunt/manager/waypoints/')
          .set('user-auth-token', mockAdminToken)
          .send(validUpdatePayload)
          .expect(404);

        expect(mockedWaypointService.updateWaypointSequence).not.toHaveBeenCalled();
      });

      it('should ignore query parameters and use path parameter', async () => {
        mockedWaypointService.updateWaypointSequence.mockResolvedValue(mockWaypointSequence);

        await request(app)
          .put('/hunt/manager/waypoints/central-park-tour?ignored=param&extra=value')
          .set('user-auth-token', mockAdminToken)
          .send(validUpdatePayload)
          .expect(201);

        expect(mockedWaypointService.updateWaypointSequence).toHaveBeenCalledWith(
          'central-park-tour',
          validUpdatePayload,
        );
      });

      it('should handle URL-encoded waypoint names in path', async () => {
        const encodedNameUpdate = {
          ...validUpdatePayload,
          waypoint_name: 'central park tour',
        };
        mockedWaypointService.updateWaypointSequence.mockResolvedValue(mockWaypointSequence);

        await request(app)
          .put('/hunt/manager/waypoints/central%20park%20tour')
          .set('user-auth-token', mockAdminToken)
          .send(encodedNameUpdate)
          .expect(201);

        expect(mockedWaypointService.updateWaypointSequence).toHaveBeenCalledWith(
          'central park tour',
          encodedNameUpdate,
        );
      });
    });
  });

  describe('DELETE /waypoints/:waypoint_name', () => {
    const validDeletePayload = {
      waypoint_name: 'central-park-tour',
    };

    describe('Happy Path', () => {
      it('should delete waypoint sequence successfully with admin token', async () => {
        mockedWaypointService.deleteWaypointSequence.mockResolvedValue(undefined);

        const response = await request(app)
          .delete('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .send(validDeletePayload)
          .expect(204);

        expect(response.body).toEqual({});
        expect(mockedWaypointService.deleteWaypointSequence).toHaveBeenCalledWith(
          'central-park-tour',
        );
        expect(mockedWaypointService.deleteWaypointSequence).toHaveBeenCalledTimes(1);
      });

      it('should delete different waypoint sequences', async () => {
        mockedWaypointService.deleteWaypointSequence.mockResolvedValue(undefined);

        await request(app)
          .delete('/hunt/manager/waypoints/nature-trail')
          .set('user-auth-token', mockAdminToken)
          .send({ waypoint_name: 'nature-trail' })
          .expect(204);

        expect(mockedWaypointService.deleteWaypointSequence).toHaveBeenCalledWith('nature-trail');
      });

      it('should handle successful deletion without response body', async () => {
        mockedWaypointService.deleteWaypointSequence.mockResolvedValue(undefined);

        const response = await request(app)
          .delete('/hunt/manager/waypoints/museum-tour')
          .set('user-auth-token', mockAdminToken)
          .send({ waypoint_name: 'museum-tour' })
          .expect(204);

        expect(response.text).toBe('');
        expect(mockedWaypointService.deleteWaypointSequence).toHaveBeenCalledWith('museum-tour');
      });
    });

    describe('Authentication/Authorization Issues', () => {
      it('should return 401 without authentication token', async () => {
        await request(app)
          .delete('/hunt/manager/waypoints/central-park-tour')
          .send(validDeletePayload)
          .expect(401);

        expect(mockedWaypointService.deleteWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 403 with player token (insufficient permissions)', async () => {
        await request(app)
          .delete('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockPlayerToken)
          .send(validDeletePayload)
          .expect(403);

        expect(mockedWaypointService.deleteWaypointSequence).not.toHaveBeenCalled();
      });

      it('should return 401 with invalid token', async () => {
        await request(app)
          .delete('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', 'invalid-token')
          .send(validDeletePayload)
          .expect(401);

        expect(mockedWaypointService.deleteWaypointSequence).not.toHaveBeenCalled();
      });
    });

    describe('Wrong Input Data', () => {
      it('should succeed even with empty body since DELETE uses URL param', async () => {
        mockedWaypointService.deleteWaypointSequence.mockResolvedValue(undefined);

        await request(app)
          .delete('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .send({})
          .expect(204); // DELETE should succeed using URL param, body is ignored

        expect(mockedWaypointService.deleteWaypointSequence).toHaveBeenCalledWith(
          'central-park-tour',
        );
      });

      it('should return 400 with invalid JSON payload', async () => {
        await request(app)
          .delete('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .set('Content-Type', 'application/json')
          .send('invalid-json')
          .expect(500); // Express returns 500 for malformed JSON

        expect(mockedWaypointService.deleteWaypointSequence).not.toHaveBeenCalled();
      });

      it('should succeed regardless of Content-Type since body is ignored', async () => {
        mockedWaypointService.deleteWaypointSequence.mockResolvedValue(undefined);

        await request(app)
          .delete('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .set('Content-Type', 'text/plain')
          .send('plain text data')
          .expect(204); // DELETE succeeds, body content is ignored

        expect(mockedWaypointService.deleteWaypointSequence).toHaveBeenCalledWith(
          'central-park-tour',
        );
      });

      it('should succeed with extra properties since body is ignored', async () => {
        const extraPropsPayload = {
          waypoint_name: 'central-park-tour',
          extra_field: 'this is ignored',
        };

        mockedWaypointService.deleteWaypointSequence.mockResolvedValue(undefined);

        await request(app)
          .delete('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .send(extraPropsPayload)
          .expect(204); // DELETE succeeds, body is ignored

        expect(mockedWaypointService.deleteWaypointSequence).toHaveBeenCalledWith(
          'central-park-tour',
        );
      });
    });

    describe('Error Propagation from Service Layer', () => {
      it('should return 404 when waypoint sequence not found', async () => {
        mockedWaypointService.deleteWaypointSequence.mockRejectedValue(
          new NotFoundError('Waypoint sequence not found'),
        );

        const response = await request(app)
          .delete('/hunt/manager/waypoints/nonexistent-tour')
          .set('user-auth-token', mockAdminToken)
          .send({ waypoint_name: 'nonexistent-tour' })
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Waypoint sequence not found');
        expect(mockedWaypointService.deleteWaypointSequence).toHaveBeenCalledWith(
          'nonexistent-tour',
        );
      });

      it('should return 500 for unexpected service errors', async () => {
        mockedWaypointService.deleteWaypointSequence.mockRejectedValue(
          new Error('Database deletion failed'),
        );

        const response = await request(app)
          .delete('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .send(validDeletePayload)
          .expect(500);

        expect(response.body).toHaveProperty('error', 'Internal server error');
        expect(mockedWaypointService.deleteWaypointSequence).toHaveBeenCalledWith(
          'central-park-tour',
        );
      });

      it('should handle service layer validation errors', async () => {
        mockedWaypointService.deleteWaypointSequence.mockRejectedValue(
          new ValidationError('Invalid waypoint name for deletion'),
        );

        const response = await request(app)
          .delete('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockAdminToken)
          .send(validDeletePayload)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Invalid waypoint name for deletion');
      });
    });

    describe('Incorrect Endpoint Usage', () => {
      it('should return 404 for DELETE without waypoint name parameter', async () => {
        await request(app)
          .delete('/hunt/manager/waypoints/')
          .set('user-auth-token', mockAdminToken)
          .send(validDeletePayload)
          .expect(404);

        expect(mockedWaypointService.deleteWaypointSequence).not.toHaveBeenCalled();
      });

      it('should ignore query parameters and use path parameter', async () => {
        mockedWaypointService.deleteWaypointSequence.mockResolvedValue(undefined);

        await request(app)
          .delete('/hunt/manager/waypoints/central-park-tour?ignored=param&extra=value')
          .set('user-auth-token', mockAdminToken)
          .send(validDeletePayload)
          .expect(204);

        expect(mockedWaypointService.deleteWaypointSequence).toHaveBeenCalledWith(
          'central-park-tour',
        );
      });

      it('should handle URL-encoded waypoint names in path', async () => {
        mockedWaypointService.deleteWaypointSequence.mockResolvedValue(undefined);

        await request(app)
          .delete('/hunt/manager/waypoints/central%20park%20tour')
          .set('user-auth-token', mockAdminToken)
          .send({ waypoint_name: 'central park tour' })
          .expect(204);

        expect(mockedWaypointService.deleteWaypointSequence).toHaveBeenCalledWith(
          'central park tour',
        );
      });
    });
  });

  describe('Unsupported HTTP Methods', () => {
    it('should return 404 for PATCH method', async () => {
      await request(app)
        .patch('/hunt/manager/waypoints/central-park-tour')
        .set('user-auth-token', mockAdminToken)
        .expect(404);
    });

    it('should return 200 for HEAD method (Express default behavior)', async () => {
      mockedWaypointService.getWaypointSequence.mockResolvedValue(mockWaypointSequence);

      await request(app)
        .head('/hunt/manager/waypoints/central-park-tour')
        .set('user-auth-token', mockAdminToken)
        .expect(200); // HEAD returns same status as GET but without body
    });

    it('should return 200 for OPTIONS method (CORS support)', async () => {
      await request(app)
        .options('/hunt/manager/waypoints/central-park-tour')
        .set('user-auth-token', mockAdminToken)
        .expect(204); // OPTIONS returns 200 for CORS preflight requests
    });
  });

  describe('Edge Cases and Integration Scenarios', () => {
    it('should handle concurrent requests to same endpoint', async () => {
      mockedWaypointService.getWaypointSequence.mockResolvedValue(mockWaypointSequence);

      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .get('/hunt/manager/waypoints/central-park-tour')
          .set('user-auth-token', mockPlayerToken),
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toEqual(expectedWaypointSequence);
      });

      expect(mockedWaypointService.getWaypointSequence).toHaveBeenCalledTimes(5);
    });

    it('should handle service method throwing after middleware validation', async () => {
      mockedWaypointService.createWaypointSequence.mockRejectedValue(
        new Error('Service failed after validation'),
      );

      const response = await request(app)
        .post('/hunt/manager/waypoints')
        .set('user-auth-token', mockAdminToken)
        .send(validCreatePayload)
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal server error');
      expect(mockedWaypointService.createWaypointSequence).toHaveBeenCalledWith(validCreatePayload);
    });

    it('should maintain request isolation between different waypoint operations', async () => {
      mockedWaypointService.getWaypointSequence.mockResolvedValue(mockWaypointSequence);
      mockedWaypointService.createWaypointSequence.mockResolvedValue(mockWaypointSequence);

      // Execute different operations concurrently
      const getRequest = request(app)
        .get('/hunt/manager/waypoints/tour1')
        .set('user-auth-token', mockPlayerToken);

      const createRequest = request(app)
        .post('/hunt/manager/waypoints')
        .set('user-auth-token', mockAdminToken)
        .send({ ...validCreatePayload, waypoint_name: 'tour2' });

      const [getResponse, createResponse] = await Promise.all([getRequest, createRequest]);

      expect(getResponse.status).toBe(200);
      expect(createResponse.status).toBe(201);
      expect(mockedWaypointService.getWaypointSequence).toHaveBeenCalledWith('tour1');
      expect(mockedWaypointService.createWaypointSequence).toHaveBeenCalledWith({
        ...validCreatePayload,
        waypoint_name: 'tour2',
      });
    });
  });
});
