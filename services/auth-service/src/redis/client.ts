import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('[redis] error:', err.message);
});

redis.on('connect', () => {
  console.info('[redis] connected');
});
