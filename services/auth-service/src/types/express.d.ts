import type { FeastFiteJwtPayload } from '@feastfite/shared';

declare global {
  namespace Express {
    interface Request {
      user?: FeastFiteJwtPayload;
    }
  }
}

export {};
