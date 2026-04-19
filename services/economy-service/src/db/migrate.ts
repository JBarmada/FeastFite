import { pool } from './client';

export async function runMigrations(): Promise<void> {
  // Base tables — IF NOT EXISTS is safe on both first run and restarts
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL,
      delta        INTEGER NOT NULL,
      reason       TEXT NOT NULL,
      reference_id TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_stats (
      user_id          UUID PRIMARY KEY,
      total_points     INTEGER NOT NULL DEFAULT 0,
      current_streak   INTEGER NOT NULL DEFAULT 0,
      last_upload_date DATE
    );

    CREATE TABLE IF NOT EXISTS shop_items (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      price_points INTEGER NOT NULL CHECK (price_points > 0),
      item_type    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_inventory (
      user_id  UUID NOT NULL,
      item_id  TEXT NOT NULL REFERENCES shop_items (id),
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      PRIMARY KEY (user_id, item_id)
    );
  `);

  // Safe column additions for existing deployments
  await pool.query(`ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS restaurant_id UUID;`);

  // Indexes (IF NOT EXISTS prevents duplicates)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_entries (user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ledger_restaurant ON ledger_entries (restaurant_id);`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_idempotency
      ON ledger_entries (reference_id)
      WHERE reference_id IS NOT NULL;
  `);

  // Seed data
  await pool.query(`
    INSERT INTO shop_items (id, name, price_points, item_type) VALUES
      ('double_points',    'Double Points',    100, 'boost'),
      ('territory_shield', 'Territory Shield', 200, 'consumable'),
      ('battering_ram',    'Battering Ram',    500, 'consumable')
    ON CONFLICT (id) DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO ledger_entries (user_id, delta, reason, reference_id)
    SELECT '00000000-0000-4000-8000-000000000001',
           1000,
           'dev_seed_bonus',
           'dev_seed:bonus_1000'
    WHERE NOT EXISTS (
      SELECT 1 FROM ledger_entries WHERE reference_id = 'dev_seed:bonus_1000'
    );
  `);

  console.info('[db] migrations complete');
}
