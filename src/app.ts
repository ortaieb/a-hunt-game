import express, { Request, Response } from 'express';
import userRoutes from './modules/users/user.routes';
import authRoutes from './modules/auths/auth.routes';
import waypointRoutes from './routes/waypoints';

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

// Waypoints management routes
app.use('/hunt/manager/waypoints', waypointRoutes);

// Registration route (alternative path as specified in issue)
app.use('/hunt/auth', authRoutes);

// Waypoints management routes
app.use('/hunt/manager/waypoints', waypointRoutes);

export default app;
