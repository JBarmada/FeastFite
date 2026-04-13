function require(name: string, fallback?: string): string {
  const val = process.env[name] ?? fallback;
  if (val === undefined) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',

  jwt: {
    secret: require('JWT_SECRET', 'dev_only_secret_change_in_production'),
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '15m',
  },

  db: {
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
    database: process.env['DB_NAME'] ?? 'auth_db',
    user: process.env['DB_USER'] ?? 'feastfite',
    password: process.env['DB_PASSWORD'] ?? 'devpassword',
  },

  redis: {
    url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  },

  rabbitmq: {
    url: process.env['RABBITMQ_URL'] ?? 'amqp://guest:guest@localhost:5672',
    exchange: process.env['RABBITMQ_EXCHANGE'] ?? 'feastfite.events',
  },

  refreshToken: {
    ttlSeconds: 7 * 24 * 60 * 60, // 7 days
    cookieName: 'ff_refresh',
  },
} as const;
