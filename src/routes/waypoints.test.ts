import request from 'supertest';
import app from '../app';
import { WaypointModel } from '../models/Waypoint';
import { generateToken } from '../middleware/auth';
import { UserModel } from '../models/User';
import { uuidV7ForTest } from '../test-support/funcs/uuid';

// Mock dependencies
jest.mock('../models/Waypoint');
jest.mock('../models/User');

const mockedWaypointModel = WaypointModel as jest.Mocked<typeof WaypointModel>;
const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe('Waypoints Routes', () => {
  let adminToken: string;

  beforeAll(() => {
    // Create admin token for testing
    adminToken = generateToken('admin@test.com', ['game.admin'], 'Admin User');
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock admin user lookup for authentication
    mockedUserModel.findActiveByUsername.mockResolvedValue({
      user_id: uuidV7ForTest(0, 1),
      username: 'admin@test.com',
      password_hash: 'hash',
      nickname: 'Admin User',
      roles: ['game.admin'],
      valid_from: new Date(),
      valid_until: null,
    });
  });

  const validWaypointDataInternal = [
    {
      waypoint_seq_id: 1,
      location: { lat: 40.7128, long: -74.006 },
      radius: 50,
      clue: 'Find the tall building with the green roof',
      hints: ['Look for the spire', 'Near the park'],
      image_subject: 'Green roof building',
    },
    {
      waypoint_seq_id: 2,
      location: { lat: 40.7589, long: -73.9851 },
      radius: 30,
      clue: 'Locate the fountain in the square',
      hints: ['Center of the plaza'],
      image_subject: 'Water fountain',
    },
  ];

  const validWaypointDataJSON = [
    {
      'waypoint-seq-id': 1,
      location: { lat: 40.7128, long: -74.006 },
      radius: 50,
      clue: 'Find the tall building with the green roof',
      hints: ['Look for the spire', 'Near the park'],
      'image-subject': 'Green roof building',
    },
    {
      'waypoint-seq-id': 2,
      location: { lat: 40.7589, long: -73.9851 },
      radius: 30,
      clue: 'Locate the fountain in the square',
      hints: ['Center of the plaza'],
      'image-subject': 'Water fountain',
    },
  ];

  describe('GET /hunt/manager/waypoints', () => {
    it('should get all waypoint sequences for admin user', async () => {
      const mockWaypoints = [
        {
          waypoints_id: 1,
          waypoint_name: 'Central Park Tour',
          waypoint_description: 'A scenic tour of Central Park',
          data: validWaypointDataInternal,
          valid_from: new Date(),
          valid_until: null,
        },
        {
          waypoints_id: 2,
          waypoint_name: 'City Center Tour',
          waypoint_description: 'Explore the city center',
          data: validWaypointDataInternal,
          valid_from: new Date(),
          valid_until: null,
        },
      ];

      mockedWaypointModel.getAllActive.mockResolvedValue(mockWaypoints);

      const response = await request(app)
        .get('/hunt/manager/waypoints')
        .set('user-auth-token', adminToken);

      expect(response.status).toBe(200);
      expect(response.body.waypoint_sequences).toHaveLength(2);
      expect(response.body.waypoint_sequences[0]).toEqual({
        waypoints_id: 1,
        waypoint_name: 'Central Park Tour',
        waypoint_description: 'A scenic tour of Central Park',
        data: validWaypointDataJSON,
        valid_from: mockWaypoints[0].valid_from.toISOString(),
      });
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/hunt/manager/waypoints');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('request did not include token');
    });

    it('should require game.admin role', async () => {
      const userToken = generateToken('user@test.com', ['user'], 'Regular User');

      mockedUserModel.findActiveByUsername.mockResolvedValue({
        user_id: uuidV7ForTest(0, 2),
        username: 'user@test.com',
        password_hash: 'hash',
        nickname: 'Regular User',
        roles: ['user'],
        valid_from: new Date(),
        valid_until: null,
      });

      const response = await request(app)
        .get('/hunt/manager/waypoints')
        .set('user-auth-token', userToken);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('insufficient permissions');
    });
  });

  describe('GET /hunt/manager/waypoints/summary', () => {
    it('should get waypoint summaries for admin user', async () => {
      const mockWaypoints = [
        {
          waypoints_id: 1,
          waypoint_name: 'Central Park Tour',
          waypoint_description: 'A scenic tour of Central Park',
          data: validWaypointDataInternal,
          valid_from: new Date(),
          valid_until: null,
        },
        {
          waypoints_id: 2,
          waypoint_name: 'City Center Tour',
          waypoint_description: 'Explore the city center',
          data: validWaypointDataInternal,
          valid_from: new Date(),
          valid_until: null,
        },
      ];

      mockedWaypointModel.getAllActive.mockResolvedValue(mockWaypoints);

      const response = await request(app)
        .get('/hunt/manager/waypoints/summary')
        .set('user-auth-token', adminToken);

      expect(response.status).toBe(200);
      expect(response.body.waypoint_summaries).toHaveLength(2);
      expect(response.body.waypoint_summaries[0]).toEqual({
        'waypoint-name': 'Central Park Tour',
        'waypoint-description': 'A scenic tour of Central Park',
      });
      expect(response.body.waypoint_summaries[1]).toEqual({
        'waypoint-name': 'City Center Tour',
        'waypoint-description': 'Explore the city center',
      });
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/hunt/manager/waypoints/summary');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('request did not include token');
    });

    it('should require game.admin role', async () => {
      const userToken = generateToken('user@test.com', ['user'], 'Regular User');

      mockedUserModel.findActiveByUsername.mockResolvedValue({
        user_id: uuidV7ForTest(0, 2),
        username: 'user@test.com',
        password_hash: 'hash',
        nickname: 'Regular User',
        roles: ['user'],
        valid_from: new Date(),
        valid_until: null,
      });

      const response = await request(app)
        .get('/hunt/manager/waypoints/summary')
        .set('user-auth-token', userToken);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('insufficient permissions');
    });

    it('should return empty array when no waypoints exist', async () => {
      mockedWaypointModel.getAllActive.mockResolvedValue([]);

      const response = await request(app)
        .get('/hunt/manager/waypoints/summary')
        .set('user-auth-token', adminToken);

      expect(response.status).toBe(200);
      expect(response.body.waypoint_summaries).toEqual([]);
    });

    it('should handle internal server errors', async () => {
      mockedWaypointModel.getAllActive.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/hunt/manager/waypoints/summary')
        .set('user-auth-token', adminToken);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch waypoint summaries');
    });
  });

  describe('GET /hunt/manager/waypoints/:waypoint_name', () => {
    it('should get specific waypoint sequence', async () => {
      const mockWaypoint = {
        waypoints_id: 1,
        waypoint_name: 'Central Park Tour',
        waypoint_description: 'A scenic tour of Central Park',
        data: validWaypointDataInternal,
        valid_from: new Date(),
        valid_until: null,
      };

      mockedWaypointModel.findActiveByName.mockResolvedValue(mockWaypoint);

      const response = await request(app)
        .get('/hunt/manager/waypoints/Central Park Tour')
        .set('user-auth-token', adminToken);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        waypoints_id: 1,
        waypoint_name: 'Central Park Tour',
        waypoint_description: 'A scenic tour of Central Park',
        data: validWaypointDataJSON,
        valid_from: mockWaypoint.valid_from.toISOString(),
      });
    });

    it('should return 404 for non-existent waypoint', async () => {
      mockedWaypointModel.findActiveByName.mockResolvedValue(null);

      const response = await request(app)
        .get('/hunt/manager/waypoints/Non-existent')
        .set('user-auth-token', adminToken);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Waypoint sequence not found');
    });

    it('should handle spaces in waypoint names', async () => {
      mockedWaypointModel.findActiveByName.mockResolvedValue(null);

      const response = await request(app)
        .get('/hunt/manager/waypoints/Valid Name') // Space in name is actually valid
        .set('user-auth-token', adminToken);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Waypoint sequence not found');
    });
  });

  describe('POST /hunt/manager/waypoints', () => {
    it('should create new waypoint sequence', async () => {
      const newWaypoint = {
        waypoints_id: 1,
        waypoint_name: 'New Tour',
        waypoint_description: 'A new exciting tour',
        data: validWaypointDataInternal,
        valid_from: new Date(),
        valid_until: null,
      };

      mockedWaypointModel.findActiveByName.mockResolvedValue(null); // Doesn't exist
      mockedWaypointModel.create.mockResolvedValue(newWaypoint);

      const response = await request(app)
        .post('/hunt/manager/waypoints')
        .set('user-auth-token', adminToken)
        .send({
          waypoint_name: 'New Tour',
          waypoint_description: 'A new exciting tour',
          data: validWaypointDataJSON,
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        waypoints_id: 1,
        waypoint_name: 'New Tour',
        waypoint_description: 'A new exciting tour',
        data: validWaypointDataJSON,
      });
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/hunt/manager/waypoints')
        .set('user-auth-token', adminToken)
        .send({
          waypoint_name: 'Test Tour',
          // Missing waypoint_description and data
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        'Missing required fields: waypoint_name, waypoint_description, data',
      );
    });

    it('should reject invalid waypoint name', async () => {
      const response = await request(app)
        .post('/hunt/manager/waypoints')
        .set('user-auth-token', adminToken)
        .send({
          waypoint_name: '', // Empty name
          waypoint_description: 'Test description',
          data: validWaypointDataJSON,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        'Missing required fields: waypoint_name, waypoint_description, data',
      );
    });

    it('should reject empty waypoint description', async () => {
      const response = await request(app)
        .post('/hunt/manager/waypoints')
        .set('user-auth-token', adminToken)
        .send({
          waypoint_name: 'Test Tour',
          waypoint_description: '', // Empty description
          data: validWaypointDataJSON,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        'Missing required fields: waypoint_name, waypoint_description, data',
      );
    });

    it('should reject too long waypoint name', async () => {
      const longName = 'a'.repeat(256); // Longer than 255 chars
      const response = await request(app)
        .post('/hunt/manager/waypoints')
        .set('user-auth-token', adminToken)
        .send({
          waypoint_name: longName,
          waypoint_description: 'Valid description',
          data: validWaypointDataJSON,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('waypoint_name must be 1-255 characters long');
    });

    it('should reject duplicate waypoint name', async () => {
      mockedWaypointModel.findActiveByName.mockResolvedValue({
        waypoints_id: 1,
        waypoint_name: 'Existing Tour',
        waypoint_description: 'Already exists',
        data: [],
        valid_from: new Date(),
        valid_until: null,
      });

      const response = await request(app)
        .post('/hunt/manager/waypoints')
        .set('user-auth-token', adminToken)
        .send({
          waypoint_name: 'Existing Tour',
          waypoint_description: 'Test description',
          data: validWaypointDataJSON,
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Waypoint sequence with this name already exists');
    });

    it('should handle validation errors from WaypointModel', async () => {
      mockedWaypointModel.findActiveByName.mockResolvedValue(null);
      mockedWaypointModel.create.mockRejectedValue(new Error('radius must be a positive number'));

      const invalidData = [
        {
          'waypoint-seq-id': 1,
          location: { lat: 40.7128, long: -74.006 },
          radius: -5, // Invalid radius
          clue: 'Test clue',
          hints: ['Test hint'],
          'image-subject': 'Test subject',
        },
      ];

      const response = await request(app)
        .post('/hunt/manager/waypoints')
        .set('user-auth-token', adminToken)
        .send({
          waypoint_name: 'Test Tour',
          waypoint_description: 'Test description',
          data: invalidData,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('radius must be a positive number');
    });
  });

  describe('PUT /hunt/manager/waypoints/:waypoint_name', () => {
    it('should update waypoint sequence', async () => {
      const updatedWaypoint = {
        waypoints_id: 1,
        waypoint_name: 'Updated Tour',
        waypoint_description: 'Updated description',
        data: validWaypointDataInternal,
        valid_from: new Date(),
        valid_until: null,
      };

      mockedWaypointModel.update.mockResolvedValue(updatedWaypoint);

      const response = await request(app)
        .put('/hunt/manager/waypoints/Updated Tour')
        .set('user-auth-token', adminToken)
        .send({
          waypoint_name: 'Updated Tour',
          waypoint_description: 'Updated description',
          data: validWaypointDataJSON,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        waypoints_id: 1,
        waypoint_name: 'Updated Tour',
        waypoint_description: 'Updated description',
        data: validWaypointDataJSON,
      });
    });

    it('should reject mismatched waypoint names', async () => {
      const response = await request(app)
        .put('/hunt/manager/waypoints/URL Name')
        .set('user-auth-token', adminToken)
        .send({
          waypoint_name: 'Body Name', // Different from URL
          waypoint_description: 'Test description',
          data: validWaypointDataJSON,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('URL waypoint_name must match body waypoint_name');
    });

    it('should handle waypoint not found', async () => {
      mockedWaypointModel.update.mockRejectedValue(new Error('Waypoint sequence not found'));

      const response = await request(app)
        .put('/hunt/manager/waypoints/Non-existent')
        .set('user-auth-token', adminToken)
        .send({
          waypoint_name: 'Non-existent',
          waypoint_description: 'Test description',
          data: validWaypointDataJSON,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Waypoint sequence not found');
    });

    it('should handle no change required', async () => {
      mockedWaypointModel.update.mockRejectedValue(new Error('No change required'));

      const response = await request(app)
        .put('/hunt/manager/waypoints/Unchanged Tour')
        .set('user-auth-token', adminToken)
        .send({
          waypoint_name: 'Unchanged Tour',
          waypoint_description: 'Same description',
          data: validWaypointDataJSON,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No change required');
    });
  });

  describe('DELETE /hunt/manager/waypoints/:waypoint_name', () => {
    it('should delete waypoint sequence', async () => {
      mockedWaypointModel.delete.mockResolvedValue();

      const response = await request(app)
        .delete('/hunt/manager/waypoints/Tour to Delete')
        .set('user-auth-token', adminToken);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });

    it('should handle waypoint not found', async () => {
      mockedWaypointModel.delete.mockRejectedValue(new Error('Waypoint sequence not found'));

      const response = await request(app)
        .delete('/hunt/manager/waypoints/Non-existent')
        .set('user-auth-token', adminToken);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Waypoint sequence not found');
    });

    it('should handle spaces in waypoint names', async () => {
      mockedWaypointModel.delete.mockRejectedValue(new Error('Waypoint sequence not found'));

      const response = await request(app)
        .delete('/hunt/manager/waypoints/Valid Name') // Space in name is actually valid
        .set('user-auth-token', adminToken);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Waypoint sequence not found');
    });
  });

  describe('Error handling', () => {
    it('should handle internal server errors', async () => {
      mockedWaypointModel.getAllActive.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/hunt/manager/waypoints')
        .set('user-auth-token', adminToken);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch waypoint sequences');
    });
  });
});
