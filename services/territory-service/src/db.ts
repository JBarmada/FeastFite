import { Pool } from 'pg';
import type { Feature, Polygon } from 'geojson';

export const pool = new Pool({
  host:     process.env['DB_HOST']     ?? 'localhost',
  port:     Number(process.env['DB_PORT'] ?? 5433),
  database: process.env['DB_NAME']     ?? 'territory_db',
  user:     process.env['DB_USER']     ?? 'feastfite',
  password: process.env['DB_PASSWORD'] ?? 'devpassword',
});

// ── Seed data ─────────────────────────────────────────────────────────────────
// Real USC Village polygon coordinates (KML source).
// Inserted automatically on first startup if the table is empty.

type Ring = [number, number][];

const SEED_TERRITORIES: [string, Ring][] = [
  ["Tangy Joe's Territory", [
    [-118.2853368, 34.0259741], [-118.2851142, 34.0256154],
    [-118.2845961, 34.0255598], [-118.2846846, 34.0260453],
    [-118.2853368, 34.0259741],
  ]],
  ['Dulce Dream Den', [
    [-118.2855469, 34.0255062], [-118.2857695, 34.0252942],
    [-118.2850171, 34.0252720], [-118.2854569, 34.0256685],
    [-118.2855469, 34.0255062],
  ]],
  ['Starry Sip Sanctum', [
    [-118.2844886, 34.0247448], [-118.2844565, 34.0243661],
    [-118.2842558, 34.0242594], [-118.2840627, 34.0246737],
    [-118.2844886, 34.0247448],
  ]],
  ['Yobo Yum Yard', [
    [-118.2848552, 34.0246292], [-118.2847801, 34.0244350],
    [-118.2846212, 34.0244895], [-118.2844951, 34.0246314],
    [-118.2848552, 34.0246292],
  ]],
  ['Tangerine Target Tundra', [
    [-118.2846118, 34.0259730], [-118.2845233, 34.0254109],
    [-118.2841258, 34.0256121], [-118.2841433, 34.0259363],
    [-118.2846118, 34.0259730],
  ]],
  ['Silky Soft Swirl Summit', [
    [-118.2848064, 34.0249741], [-118.2849593, 34.0247943],
    [-118.2846929, 34.0246337], [-118.2845458, 34.0246621],
    [-118.2846551, 34.0248757], [-118.2848064, 34.0249741],
  ]],
  ['Chickpea Citadel', [
    [-118.2849783, 34.0253720], [-118.2848951, 34.0249410],
    [-118.2845276, 34.0250989], [-118.2847408, 34.0253964],
    [-118.2849783, 34.0253720],
  ]],
  ['Dorm Dining Dome', [
    [-118.2864145, 34.0258233], [-118.2864011, 34.0255146],
    [-118.2857337, 34.0255079], [-118.2858007, 34.0259255],
    [-118.2864145, 34.0258233],
  ]],
  ["Jolly Jimmy's Junction", [
    [-118.2846172, 34.0248935], [-118.2845729, 34.0247704],
    [-118.2842638, 34.0248038], [-118.2844220, 34.0251769],
    [-118.2846172, 34.0248935],
  ]],
  ['Ramen Rendezvous Realm', [
    [-118.2855901, 34.0250524], [-118.2857296, 34.0249683],
    [-118.2854341, 34.0249838], [-118.2854609, 34.0252547],
    [-118.2855901, 34.0250524],
  ]],
  ['Crunchy Corn City', [
    [-118.2846127, 34.0243219], [-118.2845966, 34.0241022],
    [-118.2842983, 34.0240622], [-118.2841937, 34.0242074],
    [-118.2846127, 34.0243219],
  ]],
  ['Kobunga Kingdom', [
    [-118.2858393, 34.0252773], [-118.2857695, 34.0249792],
    [-118.2856159, 34.0251309], [-118.2855025, 34.0252289],
    [-118.2858393, 34.0252773],
  ]],
  ["Terra's Pizza Plateau", [
    [-118.2849688, 34.0243697], [-118.2850761, 34.0242178],
    [-118.2846447, 34.0242133], [-118.2847258, 34.0243236],
    [-118.2849688, 34.0243697],
  ]],
  ['Cookie Crumble Cove', [
    [-118.2852713, 34.0250800], [-118.2854359, 34.0249947],
    [-118.2852062, 34.0249494], [-118.2851717, 34.0250772],
    [-118.2852713, 34.0250800],
  ]],
  ['Sunny Salad Sanctuary', [
    [-118.2854238, 34.0249155], [-118.2852951, 34.0245901],
    [-118.2849137, 34.0246946], [-118.2851310, 34.0249599],
    [-118.2854238, 34.0249155],
  ]],
];

function makePolygon(ring: Ring): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

async function seedIfEmpty(): Promise<void> {
  const { rows } = await pool.query(`SELECT COUNT(*) FROM territories`);
  if (parseInt(rows[0].count, 10) > 0) return;

  console.info('[territory-service] seeding territories…');
  for (const [name, ring] of SEED_TERRITORIES) {
    const geoJson = makePolygon(ring);
    await pool.query(
      `INSERT INTO territories (name, geojson, geom)
       VALUES ($1, $2::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))`,
      [name, JSON.stringify(geoJson), JSON.stringify(geoJson.geometry)],
    );
  }
  console.info(`[territory-service] seeded ${SEED_TERRITORIES.length} territories`);
}

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
      owner_type     TEXT        CHECK (owner_type IN ('user', 'clan')),
      captured_at    TIMESTAMPTZ,
      locked_until   TIMESTAMPTZ,
      dish_photo_key TEXT,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS territories_geom_idx
      ON territories USING GIST (geom);
  `);

  await seedIfEmpty();

  console.info('[territory-service] db ready');
}
