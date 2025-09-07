import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';

function toKebabKeys<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()),
      value,
    ]),
  );
}

export const validate = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // const parsed =
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // 🔄 Transform camelCase → kebab-case on body/query/params
      req.body = toKebabKeys((parsed as any).body ?? {});

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
