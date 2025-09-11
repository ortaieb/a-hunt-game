import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';

export const validate = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Use the validated data as-is (the validator handles transformations)
      req.body = (parsed as any).body ?? {};

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.message,
        });
        return; // Explicit return after sending response
      }
      next(error);
    }
  };
};
