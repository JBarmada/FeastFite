function env(name: string, fallback?: string): string {
  const val = process.env[name] ?? fallback;
  if (val === undefined) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '3004', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',

  db: {
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '5435', 10),
    database: process.env['DB_NAME'] ?? 'economy_db',
    user: process.env['DB_USER'] ?? 'feastfite',
    password: process.env['DB_PASSWORD'] ?? 'devpassword',
  },

  rabbitmq: {
    url: process.env['RABBITMQ_URL'] ?? 'amqp://guest:guest@localhost:5672',
    exchange: process.env['RABBITMQ_EXCHANGE'] ?? 'feastfite.events',
  },

  /** Must match auth-service JWT signing secret. */
  jwtSecret: env('JWT_SECRET', 'dev_only_secret_change_in_production'),

  /** Points granted from RabbitMQ events (tune as needed). */
  points: {
    signupBonus: 100,
    voteWinner: 100,
    voteParticipant: 25,
  },
} as const;
