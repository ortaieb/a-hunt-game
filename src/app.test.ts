import request from 'supertest';
import app from './app';

describe('Server Endpoints', () => {
  describe('GET /health', () => {
    it('should respond with 200 OK when health endpoint is called', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should return a valid timestamp in ISO format', async () => {
      const response = await request(app).get('/health');

      expect(response.body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('GET /ready', () => {
    it('should respond with 400 Bad Request when ready endpoint is called', async () => {
      const response = await request(app).get('/ready');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('status', 'Bad Request');
      expect(response.body).toHaveProperty('message', 'Service not ready');
    });

    it('should return consistent error message structure', async () => {
      const response = await request(app).get('/ready');

      expect(response.body).toEqual({
        status: 'Bad Request',
        message: 'Service not ready',
      });
    });
  });

  describe('Unhandled routes', () => {
    it('should return 404 for undefined routes', async () => {
      const response = await request(app).get('/undefined-route');

      expect(response.status).toBe(404);
    });
  });
});
