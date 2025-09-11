import express, { Request, Response } from 'express';
import userRoutes from './modules/users/user.routes';
import authRoutes from './modules/auths/auth.routes';
import waypointRoutes from './modules/waypoints/waypoint.routes';
import challengeRoutes from './modules/challenges/challenge.routes';
import { errorHandler } from './shared/middleware/asyncHandler';

const app = express();

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
