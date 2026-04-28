import { db } from './client';

export async function runMigrations(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS clans (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       VARCHAR(50) UNIQUE NOT NULL,
      tag        VARCHAR(8)  NOT NULL,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email       VARCHAR(255) UNIQUE NOT NULL,
      username    VARCHAR(50)  UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      clan_id     UUID REFERENCES clans(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
    CREATE INDEX IF NOT EXISTS idx_users_clan ON users (clan_id);
  `);

  console.info('[db] migrations complete');
}
