import { pool } from './client';

export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL,
      delta        INTEGER NOT NULL,
      reason       TEXT NOT NULL,
      reference_id TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_entries (user_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_idempotency
      ON ledger_entries (reference_id)
      WHERE reference_id IS NOT NULL;

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

    INSERT INTO shop_items (id, name, price_points, item_type) VALUES
      ('double_points',    'Double Points',    100, 'boost'),
      ('territory_shield', 'Territory Shield', 200, 'consumable'),
      ('battering_ram',    'Battering Ram',    500, 'consumable')
    ON CONFLICT (id) DO NOTHING;

    -- One-time +1000 pts for local dev user (matches frontend devAuth DEV_USER_ID)
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
