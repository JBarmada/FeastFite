import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@feastfite/shared';
import { config } from '../config';
import { DEV_AUTH_BYPASS, DEV_USER_ID } from '../devAuth';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Dev bypass — set DEV_AUTH_BYPASS false in devAuth.ts to enforce JWT again.
  if (DEV_AUTH_BYPASS) {
    (req as Request & { userId: string }).userId = DEV_USER_ID;
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  try {
    const payload = verifyToken(header.slice(7), config.jwtSecret);
    (req as Request & { userId: string }).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
