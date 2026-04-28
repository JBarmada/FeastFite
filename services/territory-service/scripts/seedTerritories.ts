/**
 * Seed territories using exact real-world polygon coordinates traced from
 * USC Village (KML source), with alliterative in-game names.
 *
 * Run:  npx tsx scripts/seedTerritories.ts
 * Safe to re-run — clears and re-inserts every time.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import type { Feature, Polygon } from 'geojson';

// ── DB ────────────────────────────────────────────────────────────────────────

const pool = new Pool({
  host:     process.env['DB_HOST']     ?? 'localhost',
  port:     Number(process.env['DB_PORT'] ?? 5433),
  database: process.env['DB_NAME']     ?? 'territory_db',
  user:     process.env['DB_USER']     ?? 'feastfite',
  password: process.env['DB_PASSWORD'] ?? 'devpassword',
});

// ── Territory definitions ─────────────────────────────────────────────────────
// [inGameName, ring]
// Rings are [lng, lat] pairs, closed (first === last point).
// Altitude values from the KML source have been stripped.

type Ring = [number, number][];

const TERRITORIES: [string, Ring][] = [

  ["Tangy Joe's Turf", [               // Trader Joe's
    [-118.285306,  34.0259496],
    [-118.2850834, 34.0255909],
    [-118.2846041, 34.0255631],
    [-118.2846578, 34.026012 ],
    [-118.285306,  34.0259496],
  ]],

  ['Dulce Dream Den', [                // Cafe Dulce
    [-118.2855295, 34.0255229],
    [-118.2856434, 34.0253765],
    [-118.2852719, 34.025237 ],
    [-118.2850466, 34.0255443],
    [-118.2854046, 34.0256696],
    [-118.2855295, 34.0255229],
  ]],

  ['Starry Sip Spot', [               // Starbucks
    [-118.2844175, 34.0246375],
    [-118.2843861, 34.024445 ],
    [-118.2842149, 34.0244823],
    [-118.284235,  34.024662 ],
    [-118.2844175, 34.0246375],
  ]],

  ['Yobo Yum Yard', [                 // Yoboseyo! Superette
    [-118.2847265, 34.0245986],
    [-118.2846621, 34.0244556],
    [-118.2844811, 34.0244545],
    [-118.2845213, 34.0246264],
    [-118.2847265, 34.0245986],
  ]],

  ['Bullseye Bay', [                   // Target
    [-118.2846038, 34.0259463],
    [-118.2845756, 34.0256321],
    [-118.2841607, 34.0256288],
    [-118.2841782, 34.025953 ],
    [-118.2846038, 34.0259463],
  ]],

  ['Swirly Soft Summit', [             // Softies
    [-118.2847139, 34.0248574],
    [-118.2848587, 34.024761 ],
    [-118.2846949, 34.0246281],
    [-118.2846167, 34.0246612],
    [-118.2845512, 34.0246932],
    [-118.2846243, 34.0247779],
    [-118.2847139, 34.0248574],
  ]],

  ['Chickpea Citadel', [               // CAVA
    [-118.2846598, 34.0250613],
    [-118.2846302, 34.024926 ],
    [-118.2844391, 34.0249755],
    [-118.2844853, 34.0250957],
    [-118.2846598, 34.0250613],
  ]],

  ['Dorm Dining Dome', [               // USC Village Dining Hall
    [-118.2861154, 34.0258744],
    [-118.2863086, 34.0256535],
    [-118.2859174, 34.0254701],
    [-118.2857283, 34.025711 ],
    [-118.2861154, 34.0258744],
  ]],

  ["Jolly Jimmy's Joint", [            // Jimmy John's
    [-118.2845991, 34.0248685],
    [-118.2845548, 34.0247454],
    [-118.2842826, 34.0247832],
    [-118.2843221, 34.0249196],
    [-118.2845991, 34.0248685],
  ]],

  ['Noodle Nook', [                    // Ramen Kenjo
    [-118.2853789, 34.0249963],
    [-118.2853454, 34.0249692],
    [-118.2852944, 34.024960 ],
    [-118.2852088, 34.0249277],
    [-118.2851525, 34.0250103],
    [-118.2853073, 34.025063 ],
    [-118.2853789, 34.0249963],
  ]],

  ['Taco Town', [                      // City Tacos
    [-118.2846543, 34.0243136],
    [-118.28472,   34.0241761],
    [-118.2844545, 34.024085 ],
    [-118.2843949, 34.0242369],
    [-118.2846543, 34.0243136],
  ]],

  ['Kobunga Kingdom', [                // Kobunga
    [-118.2855972, 34.0252301],
    [-118.2857259, 34.0251315],
    [-118.2855468, 34.0250475],
    [-118.2854468, 34.0251667],
    [-118.2855972, 34.0252301],
  ]],

  ["Pizza Peak", [                     // Terra Mia Pizzeria
    [-118.2849011, 34.0244142],
    [-118.2849742, 34.0242989],
    [-118.2847413, 34.0242044],
    [-118.2846802, 34.0243481],
    [-118.2849011, 34.0244142],
  ]],

  ['Cookie Crumble Cove', [            // Insomnia Cookies
    [-118.2854034, 34.0251233],
    [-118.2854575, 34.0251346],
    [-118.2854873, 34.0250835],
    [-118.2855197, 34.0250458],
    [-118.2853879, 34.0249877],
    [-118.2853165, 34.0250989],
    [-118.2854034, 34.0251233],
  ]],

  ['Sunny Slopes', [                   // SunLife Organics
    [-118.2851308, 34.0250344],
    [-118.2852056, 34.0248904],
    [-118.2850986, 34.0248474],
    [-118.2850585, 34.0248435],
    [-118.2850277, 34.0248973],
    [-118.2849842, 34.024970 ],
    [-118.2851308, 34.0250344],
  ]],

  ["Guerrero's Grotto", [              // Guerrero's Pizza
    [-118.2867242, 34.0255546],
    [-118.2868174, 34.0254479],
    [-118.2866941, 34.0253578],
    [-118.2865787, 34.0254724],
    [-118.2867242, 34.0255546],
  ]],

  ['Tire Taco Territory', [            // Tire Shop Taco Truck
    [-118.2865559, 34.0257747],
    [-118.2866182, 34.0256646],
    [-118.2864868, 34.0255991],
    [-118.2863996, 34.0257313],
    [-118.2865559, 34.0257747],
  ]],

  ['Mocha Ministry', [                 // Ministry of Coffee
    [-118.2833956, 34.0252019],
    [-118.2835485, 34.025013 ],
    [-118.2831139, 34.0248018],
    [-118.2829664, 34.025033 ],
    [-118.2833956, 34.0252019],
  ]],

  ["Rock 'n' Reilly's", [              // Rock and Reilly's
    [-118.284259,  34.0243927],
    [-118.284251,  34.0241715],
    [-118.2839761, 34.0241698],
    [-118.2839814, 34.0243872],
    [-118.284259,  34.0243927],
  ]],

  ['Bruxie Burrow', [                  // Bruxie
    [-118.2845374, 34.0251893],
    [-118.2845435, 34.025107 ],
    [-118.2843852, 34.0251143],
    [-118.2843859, 34.0251909],
    [-118.2845374, 34.0251893],
  ]],

  ['Garden Grotto', [                  // Il Giardino Ristorante
    [-118.2844496, 34.0253027],
    [-118.2844744, 34.0252165],
    [-118.2843128, 34.0251915],
    [-118.2842752, 34.0252849],
    [-118.2844496, 34.0253027],
  ]],

  ['Sweetgreen Glen', [                // Sweetgreen
    [-118.2852889, 34.0248807],
    [-118.2853694, 34.0247696],
    [-118.2851803, 34.0246862],
    [-118.2850944, 34.0248141],
    [-118.2852889, 34.0248807],
  ]],

];

// ── GeoJSON builder ───────────────────────────────────────────────────────────

function makePolygon(ring: Ring): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function waitForDb(retries = 15, delayMs = 2000): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch {
      console.info(`[seed] DB not ready, attempt ${i}/${retries} — retrying in ${delayMs}ms…`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('[seed] DB never became ready — giving up');
}

async function seed() {
  console.info(`Seeding ${TERRITORIES.length} USC Village territories…`);  // currently 22

  await waitForDb();
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

  await pool.query(`DELETE FROM territories;`);

  let inserted = 0;
  for (const [name, ring] of TERRITORIES) {
    const geoJson = makePolygon(ring);
    await pool.query(
      `INSERT INTO territories (name, geojson, geom)
       VALUES ($1, $2::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))`,
      [name, JSON.stringify(geoJson), JSON.stringify(geoJson.geometry)],
    );
    inserted++;
  }

  console.info(`Done — ${inserted} territories inserted.`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
