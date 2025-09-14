import express, { Request, Response } from 'express';
import cors from 'cors';
import userRoutes from './modules/users/user.routes';
import authRoutes from './modules/auths/auth.routes';
import waypointRoutes from './modules/waypoints/waypoint.routes';
import challengeRoutes from './modules/challenges/challenge.routes';
import { errorHandler } from './shared/middleware/asyncHandler';

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'user-auth-token'],
}));

app.use(express.json());

app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/ready', (_req: Request, res: Response): void => {
  res.status(400).json({ status: 'Bad Request', message: 'Service not ready' });
});

// User management routes
app.use('/hunt/users', userRoutes);

// Registration route (alternative path as specified in issue)
app.use('/hunt/auth', authRoutes);

// Waypoints management routes
app.use('/hunt/manager/waypoints', waypointRoutes);

// Challenge management routes
app.use('/hunt/manager/challenges', challengeRoutes);

app.use(errorHandler);

export default app;
