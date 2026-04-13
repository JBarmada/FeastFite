import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

export interface FeastFiteJwtPayload extends JwtPayload {
  userId: string;
  email: string;
  username: string;
}

export function verifyToken(token: string, secret?: string): FeastFiteJwtPayload {
  const jwtSecret = secret ?? process.env['JWT_SECRET'];
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }
  const payload = jwt.verify(token, jwtSecret);
  if (typeof payload === 'string') {
    throw new Error('Unexpected string JWT payload');
  }
  return payload as FeastFiteJwtPayload;
}

export function signToken(
  payload: Omit<FeastFiteJwtPayload, keyof JwtPayload>,
  secret?: string,
  options?: SignOptions
): string {
  const jwtSecret = secret ?? process.env['JWT_SECRET'];
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(payload, jwtSecret, {
    expiresIn: (process.env['JWT_EXPIRES_IN'] ?? '15m') as SignOptions['expiresIn'],
    ...options,
  });
}
