import { Pool } from 'pg';

export const pool = new Pool({
  host:     process.env['DB_HOST']     ?? 'localhost',
  port:     Number(process.env['DB_PORT'] ?? 5433),
  database: process.env['DB_NAME']     ?? 'territory_db',
  user:     process.env['DB_USER']     ?? 'feastfite',
  password: process.env['DB_PASSWORD'] ?? 'devpassword',
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

/**
 * Bootstrap the PostGIS extension, territories table, and seed data.
 * Safe to call on every startup — uses IF NOT EXISTS guards and only
 * seeds when the table is empty.
 */
export async function initDb(): Promise<void> {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS territories (
      id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name           TEXT        NOT NULL,
      geojson        JSONB       NOT NULL,
      geom           GEOMETRY(POLYGON, 4326),
      owner_id       UUID,
      owner_name     TEXT,
      owner_type     TEXT        CHECK (owner_type IN ('user', 'clan')),
      captured_at    TIMESTAMPTZ,
      locked_until   TIMESTAMPTZ,
      dish_photo_key TEXT,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Add owner_name if it doesn't exist yet (safe migration)
  await pool.query(`
    ALTER TABLE territories ADD COLUMN IF NOT EXISTS owner_name TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS claim_history (
      id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      territory_id   UUID        NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
      claimant_id    TEXT        NOT NULL,
      claimant_name  TEXT        NOT NULL,
      photo_key      TEXT,
      is_winner      BOOLEAN     NOT NULL DEFAULT false,
      session_id     TEXT,
      avg_rating     NUMERIC(4,2),
      vote_count     INT         NOT NULL DEFAULT 0,
      total_rating   INT         NOT NULL DEFAULT 0,
      claimed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Safe migrations for existing deployments
  await pool.query(`ALTER TABLE claim_history ADD COLUMN IF NOT EXISTS session_id TEXT;`);
  await pool.query(`ALTER TABLE claim_history ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(4,2);`);
  await pool.query(`ALTER TABLE claim_history ADD COLUMN IF NOT EXISTS vote_count INT NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE claim_history ADD COLUMN IF NOT EXISTS total_rating INT NOT NULL DEFAULT 0;`);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS claim_history_territory_idx
      ON claim_history (territory_id, claimed_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS territories_geom_idx
      ON territories USING GIST (geom);
  `);

  console.info('[territory-service] db ready');
}
