/**
 * Seed ~50 food-themed territories around USC Village, Los Angeles.
 *
 * Run:
 *   npx tsx scripts/seedTerritories.ts
 *
 * Env vars (falls back to docker-compose defaults):
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 *
 * To add a new zone:
 *   1. Add an entry to TERRITORIES with a center lat/lng and alliterative name.
 *   2. Re-run this script (uses INSERT … ON CONFLICT DO NOTHING, so safe to re-run).
 *   3. Expand MAP_CONFIG.maxBounds in the frontend if the new coords are outside current bounds.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import type { Feature, Polygon } from 'geojson';

// ── DB connection ─────────────────────────────────────────────────────────────

const pool = new Pool({
  host:     process.env['DB_HOST']     ?? 'localhost',
  port:     Number(process.env['DB_PORT'] ?? 5433),
  database: process.env['DB_NAME']     ?? 'territory_db',
  user:     process.env['DB_USER']     ?? 'feastfite',
  password: process.env['DB_PASSWORD'] ?? 'devpassword',
});

// ── GeoJSON helper ────────────────────────────────────────────────────────────
// Creates a rectangular GeoJSON Feature (Polygon) from a centre point.
// dlat / dlng are the half-extents in degrees (default ≈ 40 × 35 m at 34° lat).

function makeRect(
  lat: number,
  lng: number,
  dlat = 0.00018,
  dlng = 0.00022,
): Feature<Polygon> {
  const n = lat + dlat;
  const s = lat - dlat;
  const e = lng + dlng;
  const w = lng - dlng;

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      // GeoJSON rings are [lng, lat] and must close (first === last point)
      coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
    },
  };
}

// ── Territory definitions ─────────────────────────────────────────────────────
// name: alliterative food nickname (shown in-game)
// lat/lng: approximate centre of the real-world location
//
// Zones:
//   A. USC Village Core  (restaurant strip on Figueroa)
//   B. Village Plazas & Edges
//   C. USC Main Campus
//   D. Exposition Park

const TERRITORIES: { name: string; lat: number; lng: number }[] = [
  // ── A. USC Village Core ───────────────────────────────────────────
  { name: 'Matcha Meadows',            lat: 34.0262, lng: -118.2848 }, // Dulce
  { name: 'Buttery Biscuit Boulevard', lat: 34.0259, lng: -118.2844 }, // 85°C Bakery
  { name: 'Crispy Cluck Corner',       lat: 34.0256, lng: -118.2841 }, // Chick-fil-A
  { name: 'Caramel Castle',            lat: 34.0263, lng: -118.2842 }, // Starbucks
  { name: 'Chickpea Citadel',          lat: 34.0265, lng: -118.2847 }, // Cava
  { name: 'Miso Meadows',              lat: 34.0260, lng: -118.2840 }, // Mendocino Farms
  { name: 'Daring Dragon Den',         lat: 34.0257, lng: -118.2838 }, // Dave's Hot Chicken
  { name: 'Poke Paradise',             lat: 34.0254, lng: -118.2844 }, // Pokéworks
  { name: 'Lemon Lagoon',              lat: 34.0255, lng: -118.2841 }, // Lemonade
  { name: 'Sugar Shake Shoals',        lat: 34.0268, lng: -118.2848 }, // Shake Shack
  { name: 'Soft Serve Sanctuary',      lat: 34.0266, lng: -118.2843 }, // SomiSomi
  { name: 'Tangy Tropics',             lat: 34.0264, lng: -118.2840 }, // Trader Joe's
  { name: 'Taco Terrarium',            lat: 34.0261, lng: -118.2837 }, // Tocaya
  { name: 'Peachy Preserve',           lat: 34.0258, lng: -118.2835 }, // Pressed Juicery
  { name: 'Philz Plateau',             lat: 34.0270, lng: -118.2842 }, // Philz Coffee

  // ── B. Village Plazas & Edges ─────────────────────────────────────
  { name: 'Candy Central',             lat: 34.0262, lng: -118.2852 }, // Village central plaza
  { name: 'Watermelon Walk',           lat: 34.0258, lng: -118.2855 }, // Village west side
  { name: 'Elderberry East End',       lat: 34.0260, lng: -118.2834 }, // Village east entry
  { name: 'Noodle Nirvana Nook',       lat: 34.0272, lng: -118.2844 }, // Village north end
  { name: 'Jellybean Junction',        lat: 34.0248, lng: -118.2847 }, // Village south entry
  { name: 'Fudge Fountain',            lat: 34.0241, lng: -118.2852 }, // Figueroa & 30th
  { name: 'Fudge Fields North',        lat: 34.0276, lng: -118.2846 }, // Figueroa north strip
  { name: 'Honeycomb Highlands',       lat: 34.0261, lng: -118.2921 }, // Hoover St corridor
  { name: 'Caramel Crosswalk',         lat: 34.0219, lng: -118.2853 }, // Jefferson & Figueroa
  { name: 'Éclair Express',            lat: 34.0280, lng: -118.2847 }, // Exposition & Figueroa

  // ── C. USC Main Campus ────────────────────────────────────────────
  { name: 'Macaron Meadows',           lat: 34.0208, lng: -118.2843 }, // McCarthy Quad
  { name: 'Toffee Terrace',            lat: 34.0212, lng: -118.2847 }, // Tommy Trojan
  { name: 'Dulce Doheny',              lat: 34.0210, lng: -118.2832 }, // Doheny Library
  { name: 'Almond Arbor',              lat: 34.0218, lng: -118.2840 }, // Alumni Park
  { name: 'Taffy Trail',               lat: 34.0213, lng: -118.2852 }, // Trousdale Pkwy
  { name: 'Gumdrop Grounds',           lat: 34.0222, lng: -118.2860 }, // Galen Center
  { name: 'Honey Heritage',            lat: 34.0218, lng: -118.2865 }, // Heritage Hall
  { name: 'Cookie Court',              lat: 34.0224, lng: -118.2870 }, // Cromwell Field
  { name: 'Pavlova Pavilion',          lat: 34.0205, lng: -118.2855 }, // Founders Park lawn
  { name: 'Raspberry Row',             lat: 34.0228, lng: -118.2875 }, // Row Houses area
  { name: 'Brittle Boulevard',         lat: 34.0285, lng: -118.2853 }, // Exposition Blvd bridge
  { name: 'Sprinkle Square',           lat: 34.0232, lng: -118.2878 }, // Shrine Auditorium west
  { name: 'Pistachio Plaza',           lat: 34.0228, lng: -118.2838 }, // Lyon Center / PED
  { name: 'Waffle Willow Way',         lat: 34.0268, lng: -118.2875 }, // W 28th area
  { name: 'Berry Bliss Boulevard',     lat: 34.0245, lng: -118.2875 }, // Parking/Budweiser lot

  // ── D. Exposition Park ────────────────────────────────────────────
  { name: 'Éclair Exposition',         lat: 34.0168, lng: -118.2858 }, // Exposition Park main
  { name: 'Nougat Natural',            lat: 34.0173, lng: -118.2845 }, // Natural History Museum
  { name: 'Caramel Science',           lat: 34.0170, lng: -118.2868 }, // California Science Center
  { name: 'Raspberry Rose Garden',     lat: 34.0180, lng: -118.2840 }, // Rose Garden
  { name: 'Peppermint Park',           lat: 34.0175, lng: -118.2855 }, // Central park lawn
  { name: 'Sugar Shrine',              lat: 34.0185, lng: -118.2875 }, // Shrine Auditorium south
  { name: 'Flan Fields',               lat: 34.0178, lng: -118.2870 }, // Swimming Stadium
  { name: 'Cocoa Corner',              lat: 34.0162, lng: -118.2875 }, // Coliseum SW corner
  { name: 'Toffee Track',              lat: 34.0155, lng: -118.2868 }, // Coliseum field/track
  { name: 'Licorice Lane',             lat: 34.0145, lng: -118.2878 }, // MLK Blvd edge
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.info(`Seeding ${TERRITORIES.length} territories…`);

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
    CREATE INDEX IF NOT EXISTS territories_geom_idx ON territories USING GIST (geom);
  `);

  let inserted = 0;
  for (const t of TERRITORIES) {
    const geoJson = makeRect(t.lat, t.lng);
    const { rowCount } = await pool.query(
      `INSERT INTO territories (name, geojson, geom)
       VALUES ($1, $2::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))
       ON CONFLICT DO NOTHING`,
      [t.name, JSON.stringify(geoJson), JSON.stringify(geoJson.geometry)],
    );
    if ((rowCount ?? 0) > 0) inserted++;
  }

  console.info(`Done — ${inserted} new territories inserted (${TERRITORIES.length - inserted} already existed).`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
