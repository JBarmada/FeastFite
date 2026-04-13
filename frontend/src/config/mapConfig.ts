// ──────────────────────────────────────────────────────────────────────────────
// Map provider config
// To swap tile providers, change `tileUrl` and `tileAttribution` below.
//
// OpenStreetMap (default, no API key):
//   tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
//
// Google Maps (requires API key + billing):
//   tileUrl: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
//   subdomains: '0123'  ← pass this as subdomains prop on <TileLayer>
//
// Mapbox (requires token):
//   tileUrl: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=TOKEN'
// ──────────────────────────────────────────────────────────────────────────────

export const TILE_PROVIDER = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  subdomains: 'abc',
} as const;

// USC Village starting view
export const USC_VILLAGE_CENTER: [number, number] = [34.0259, -118.2848];

export const MAP_CONFIG = {
  defaultCenter: USC_VILLAGE_CENTER,
  defaultZoom: 17,
  minZoom: 14,
  maxZoom: 19,

  // Hard boundary — users cannot pan outside this box.
  // Expand these coords + add more seed territories to open new zones.
  maxBounds: [
    [34.0130, -118.2950], // SW corner (south of Exposition Park)
    [34.0300, -118.2800], // NE corner (north of USC Village)
  ] as [[number, number], [number, number]],
} as const;

// ── Candy-crush colour palette ────────────────────────────────────────────────
// One candy color per owner — deterministic hash from ownerId string.
export const CANDY_PALETTE = [
  '#FF6B9D', // cotton candy pink
  '#C77DFF', // grape purple
  '#FFD93D', // lemon drop yellow
  '#6BCB77', // mint green
  '#FF9A3C', // tangerine orange
  '#4ECDC4', // sea glass teal
  '#FF6B6B', // strawberry red
  '#A8DADC', // powder blue
  '#F4A261', // peach cream
  '#B5838D', // raspberry rose
] as const;

export function ownerColor(ownerId: string | null): string {
  if (!ownerId) return '#D3D3D3'; // unclaimed — light grey
  let hash = 0;
  for (let i = 0; i < ownerId.length; i++) {
    hash = (hash * 31 + ownerId.charCodeAt(i)) >>> 0;
  }
  return CANDY_PALETTE[hash % CANDY_PALETTE.length];
}
