/**
 * Seed territory data for frontend-only dev (territory-service not running).
 * Coordinates are the USC Village polygon cluster from the design reference.
 * These are shown as a fallback when the API returns no territories.
 */
import type { Territory } from '@feastfite/shared';

function makeFeature(ring: [number, number][]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[...ring, ring[0]]],
    },
  };
}

// Fake stable owner UUIDs — chosen so that hashToIndex gives spread across palette
const O = {
  cherry:    'afc10001-0000-4000-8000-000000000001',
  bubblegum: 'bfc10002-0000-4000-8000-000000000002',
  blueberry: 'cfc10003-0000-4000-8000-000000000003',
  orange:    'dfc10004-0000-4000-8000-000000000004',
  cotton:    'efc10005-0000-4000-8000-000000000005',
  lime:      'ffc10006-0000-4000-8000-000000000006',
  grape:     'a0c10007-0000-4000-8000-000000000007',
  lemon:     'b0c10008-0000-4000-8000-000000000008',
};

const N = {
  cherry:    'Dani the Donut',
  bubblegum: 'Churro Chuck',
  blueberry: 'Bean the Barista',
  orange:    'Taco Tito',
  cotton:    'Sprinkle Sam',
  lime:      'Pita Pete',
  grape:     'Grubby Gary',
  lemon:     'Jam Jelly',
};

const LOCKED_12H = new Date(Date.now() + 12 * 60 * 60 * 1000);
const VOTING_END  = new Date(Date.now() + 3 * 60 * 1000);
const NOW = new Date();

export const DEV_TERRITORIES: Territory[] = [
  {
    id: 'dev-t-001', name: "Tangy Joe's Territory",
    geoJson: makeFeature([[-118.2853368,34.0259741],[-118.2851142,34.0256154],[-118.2845961,34.0255598],[-118.2846846,34.0260453]]),
    ownerId: O.cherry, ownerName: N.cherry, ownerType: 'user',
    capturedAt: NOW, lockedUntil: null, dishPhotoKey: 'donut', updatedAt: NOW,
  },
  {
    id: 'dev-t-002', name: 'Dulce Dream Den',
    geoJson: makeFeature([[-118.2855469,34.0255062],[-118.2857695,34.0252942],[-118.2850171,34.0252720],[-118.2854569,34.0256685]]),
    ownerId: O.bubblegum, ownerName: N.bubblegum, ownerType: 'user',
    capturedAt: NOW, lockedUntil: null, dishPhotoKey: 'cookie', updatedAt: NOW,
  },
  {
    id: 'dev-t-003', name: 'Starry Sip Sanctum',
    geoJson: makeFeature([[-118.2844886,34.0247448],[-118.2844565,34.0243661],[-118.2842558,34.0242594],[-118.2840627,34.0246737]]),
    ownerId: O.blueberry, ownerName: N.blueberry, ownerType: 'user',
    capturedAt: NOW, lockedUntil: null, dishPhotoKey: 'coffee', updatedAt: NOW,
  },
  {
    id: 'dev-t-004', name: 'Yobo Yum Yard',
    geoJson: makeFeature([[-118.2848552,34.0246292],[-118.2847801,34.0244350],[-118.2846212,34.0244895],[-118.2844951,34.0246314]]),
    ownerId: null, ownerName: null, ownerType: null,
    capturedAt: null, lockedUntil: VOTING_END, dishPhotoKey: null, updatedAt: NOW,
  },
  {
    id: 'dev-t-005', name: 'Tangerine Target Tundra',
    geoJson: makeFeature([[-118.2846118,34.0259730],[-118.2845233,34.0254109],[-118.2841258,34.0256121],[-118.2841433,34.0259363]]),
    ownerId: O.orange, ownerName: N.orange, ownerType: 'user',
    capturedAt: NOW, lockedUntil: null, dishPhotoKey: 'taco', updatedAt: NOW,
  },
  {
    id: 'dev-t-006', name: 'Silky Soft Swirl Summit',
    geoJson: makeFeature([[-118.2848064,34.0249741],[-118.2849593,34.0247943],[-118.2846929,34.0246337],[-118.2845458,34.0246621],[-118.2846551,34.0248757]]),
    ownerId: O.cotton, ownerName: N.cotton, ownerType: 'user',
    capturedAt: NOW, lockedUntil: null, dishPhotoKey: 'donut', updatedAt: NOW,
  },
  {
    id: 'dev-t-007', name: 'Chickpea Citadel',
    geoJson: makeFeature([[-118.2849783,34.0253720],[-118.2848951,34.0249410],[-118.2845276,34.0250989],[-118.2847408,34.0253964]]),
    ownerId: O.lime, ownerName: N.lime, ownerType: 'user',
    capturedAt: NOW, lockedUntil: LOCKED_12H, dishPhotoKey: 'chickpea', updatedAt: NOW,
  },
  {
    id: 'dev-t-008', name: 'Dorm Dining Dome',
    geoJson: makeFeature([[-118.2864145,34.0258233],[-118.2864011,34.0255146],[-118.2857337,34.0255079],[-118.2858007,34.0259255]]),
    ownerId: O.grape, ownerName: N.grape, ownerType: 'user',
    capturedAt: NOW, lockedUntil: null, dishPhotoKey: 'salad', updatedAt: NOW,
  },
  {
    id: 'dev-t-009', name: "Jolly Jimmy's Junction",
    geoJson: makeFeature([[-118.2846172,34.0248935],[-118.2845729,34.0247704],[-118.2842638,34.0248038],[-118.2844220,34.0251769]]),
    ownerId: O.lemon, ownerName: N.lemon, ownerType: 'user',
    capturedAt: NOW, lockedUntil: null, dishPhotoKey: 'burger', updatedAt: NOW,
  },
  {
    id: 'dev-t-010', name: 'Ramen Rendezvous Realm',
    geoJson: makeFeature([[-118.2855901,34.0250524],[-118.2857296,34.0249683],[-118.2854341,34.0249838],[-118.2854609,34.0252547]]),
    ownerId: O.cherry, ownerName: N.cherry, ownerType: 'user',
    capturedAt: NOW, lockedUntil: LOCKED_12H, dishPhotoKey: 'ramen', updatedAt: NOW,
  },
  {
    id: 'dev-t-011', name: 'Crunchy Corn City',
    geoJson: makeFeature([[-118.2846127,34.0243219],[-118.2845966,34.0241022],[-118.2842983,34.0240622],[-118.2841937,34.0242074]]),
    ownerId: null, ownerName: null, ownerType: null,
    capturedAt: null, lockedUntil: null, dishPhotoKey: null, updatedAt: NOW,
  },
  {
    id: 'dev-t-012', name: 'Kobunga Kingdom',
    geoJson: makeFeature([[-118.2858393,34.0252773],[-118.2857695,34.0249792],[-118.2856159,34.0251309],[-118.2855025,34.0252289]]),
    ownerId: O.bubblegum, ownerName: N.bubblegum, ownerType: 'user',
    capturedAt: NOW, lockedUntil: null, dishPhotoKey: 'chicken', updatedAt: NOW,
  },
  {
    id: 'dev-t-013', name: "Terra's Pizza Plateau",
    geoJson: makeFeature([[-118.2849688,34.0243697],[-118.2850761,34.0242178],[-118.2846447,34.0242133],[-118.2847258,34.0243236]]),
    ownerId: O.cherry, ownerName: N.cherry, ownerType: 'user',
    capturedAt: NOW, lockedUntil: null, dishPhotoKey: 'pizza', updatedAt: NOW,
  },
  {
    id: 'dev-t-014', name: 'Cookie Crumble Cove',
    geoJson: makeFeature([[-118.2852713,34.0250800],[-118.2854359,34.0249947],[-118.2852062,34.0249494],[-118.2851717,34.0250772]]),
    ownerId: O.lemon, ownerName: N.lemon, ownerType: 'user',
    capturedAt: NOW, lockedUntil: null, dishPhotoKey: 'cookie', updatedAt: NOW,
  },
  {
    id: 'dev-t-015', name: 'Sunny Salad Sanctuary',
    geoJson: makeFeature([[-118.2854238,34.0249155],[-118.2852951,34.0245901],[-118.2849137,34.0246946],[-118.2851310,34.0249599]]),
    ownerId: null, ownerName: null, ownerType: null,
    capturedAt: null, lockedUntil: VOTING_END, dishPhotoKey: null, updatedAt: NOW,
  },
];
