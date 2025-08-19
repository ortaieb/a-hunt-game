import express, { Request, Response } from 'express';

const app = express();

app.use(express.json());

app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/ready', (_req: Request, res: Response): void => {
  res.status(400).json({ status: 'Bad Request', message: 'Service not ready' });
});

export default app;