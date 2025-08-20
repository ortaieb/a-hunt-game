import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { UserModel } from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: {
    username: string;
    roles: string[];
  };
}

export interface TokenPayload {
  username: string;
  roles: string[];
  iat?: number;
  exp?: number;
  // New JWT claims as per issue requirements
  iss?: string;
  upn?: string;
  groups?: string[];
}

export const generateToken = (username: string, roles: string[]): string => {
  const payload = {
    username,
    roles,
    // Required claims per issue specification
    iss: 'scavenger-hunt-game',
    upn: username,
    groups: roles,
  };
  
  return jwt.sign(
    payload,
    config.jwt.secret,
    { expiresIn: '2h' } as jwt.SignOptions,  // 2 hour window as specified
  );
};

export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, config.jwt.secret) as TokenPayload;
  } catch {
    throw new Error('Invalid token');
  }
};

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers['user-auth-token'];
  const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  if (!token) {
    res.status(401).json({ error: 'request did not include token' });
    return;
  }

  try {
    const decoded = verifyToken(token);
    
    // Verify user still exists and is active
    const user = await UserModel.findActiveByUsername(decoded.username);
    if (!user) {
      res.status(401).json({ error: 'request carries the wrong token' });
      return;
    }

    req.user = {
      username: decoded.username,
      roles: decoded.roles,
    };
    
    next();
  } catch {
    res.status(401).json({ error: 'request carries the wrong token' });
  }
};

export const requireRole = (requiredRole: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'request did not include token' });
      return;
    }

    if (!req.user.roles.includes(requiredRole)) {
      res.status(403).json({ error: 'insufficient permissions' });
      return;
    }

    next();
  };
};