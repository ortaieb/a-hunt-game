// src/shared/middleware/asyncHandler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors';

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
  } else {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
