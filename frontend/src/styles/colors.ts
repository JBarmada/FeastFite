/**
 * TypeScript mirror of tokens.css — candy theme.
 * Use for Leaflet polygon options, inline styles, or JS-driven color logic.
 * For CSS always prefer var(--token-name).
 */

export const colors = {
  // Brand
  primary:          '#A020C8',
  primaryHover:     '#8A18AC',
  primaryLight:     '#EDD6F7',
  primaryDim:       'rgba(160, 32, 200, 0.12)',

  secondary:        '#FF4FA3',
  secondaryHover:   '#E03D8E',
  secondaryLight:   '#FFD6EC',
  secondaryDim:     'rgba(255, 79, 163, 0.12)',

  accent:           '#00C8E0',
  accentHover:      '#00AABF',
  accentLight:      '#CCF3F9',
  accentDim:        'rgba(0, 200, 224, 0.12)',

  // Backgrounds
  bg:               '#FDF5FF',
  surface:          '#FFFFFF',
  surfaceRaised:    '#F7EAFF',
  border:           '#E2C8F0',
  borderFocus:      '#A020C8',

  // Text
  textPrimary:      '#2D1040',
  textSecondary:    '#7A5490',
  textMuted:        '#B89CC8',
  textInverse:      '#FFFFFF',

  // Semantic
  success:          '#3DC45A',
  warning:          '#FFA800',
  error:            '#FF3D5A',
  info:             '#00C8E0',

  // Economy
  points:           '#FFA800',
  itemShield:       '#00C8E0',
  itemRam:          '#FF3D5A',
  itemBoost:        '#3DC45A',
} as const;

// ── Territory state colors (for Leaflet polygon options) ─────────

export const territoryColors = {
  unclaimed: {
    fillColor: 'rgba(180, 150, 200, 0.30)',
    color:     '#C4A0D8',
  },
  voting: {
    fillColor: 'rgba(255, 168, 0, 0.45)',
    color:     '#FFA800',
  },
  locked: {
    fillColor: 'rgba(0, 200, 224, 0.40)',
    color:     '#00C8E0',
  },
} as const;

// ── Player colors (8 candy flavors) ──────────────────────────────

export const playerColors = [
  { name: 'cherry',     solid: '#FF3D5A', fill: 'rgba(255,  61,  90, 0.40)' },
  { name: 'grape',      solid: '#A020C8', fill: 'rgba(160,  32, 200, 0.40)' },
  { name: 'bubblegum',  solid: '#FF4FA3', fill: 'rgba(255,  79, 163, 0.40)' },
  { name: 'blueberry',  solid: '#3D6FFF', fill: 'rgba( 61, 111, 255, 0.40)' },
  { name: 'orange',     solid: '#FF7A00', fill: 'rgba(255, 122,   0, 0.40)' },
  { name: 'lemon',      solid: '#FFD600', fill: 'rgba(255, 214,   0, 0.40)' },
  { name: 'lime',       solid: '#3DC45A', fill: 'rgba( 61, 196,  90, 0.40)' },
  { name: 'cotton',     solid: '#00C8E0', fill: 'rgba(  0, 200, 224, 0.40)' },
] as const;

export type PlayerColorName = typeof playerColors[number]['name'];

export function getPlayerColor(name: PlayerColorName) {
  return playerColors.find((c) => c.name === name)!;
}

export function getPlayerColorByIndex(index: number) {
  return playerColors[index % playerColors.length];
}
