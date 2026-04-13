/**
 * TypeScript mirror of tokens.css.
 * Use these when you need colors in JS (e.g. Leaflet polygon options,
 * Chart.js datasets, inline styles). For CSS use var(--token-name).
 */

export const colors = {
  // Brand
  primary:          '#FF4D2E',
  primaryHover:     '#E03D20',
  primaryDim:       'rgba(255, 77, 46, 0.15)',

  secondary:        '#FFB800',
  secondaryHover:   '#E0A200',
  secondaryDim:     'rgba(255, 184, 0, 0.15)',

  accent:           '#00E5A0',
  accentHover:      '#00C98C',
  accentDim:        'rgba(0, 229, 160, 0.15)',

  // Backgrounds
  bg:               '#0D0D1A',
  surface:          '#1A1A2E',
  surfaceRaised:    '#252540',
  border:           '#2E2E50',
  borderFocus:      '#FF4D2E',

  // Text
  textPrimary:      '#F0F0FF',
  textSecondary:    '#9090B0',
  textMuted:        '#5A5A7A',
  textInverse:      '#0D0D1A',

  // Semantic
  success:          '#00E5A0',
  warning:          '#FFB800',
  error:            '#FF4D2E',
  info:             '#4A90E2',

  // Economy
  points:           '#FFB800',
  itemShield:       '#4A90E2',
  itemRam:          '#FF4D2E',
  itemBoost:        '#00E5A0',
} as const;

// ── Territory state colors (for Leaflet polygon options) ─────────

export const territoryColors = {
  unclaimed: {
    fillColor:   'rgba(60, 60, 90, 0.45)',
    color:       '#3C3C5A',
  },
  voting: {
    fillColor:   'rgba(255, 184, 0, 0.50)',
    color:       '#FFB800',
  },
  locked: {
    fillColor:   'rgba(74, 144, 226, 0.45)',
    color:       '#4A90E2',
  },
} as const;

// ── Player colors ─────────────────────────────────────────────────
// 8 named food colors assigned to players/clans.
// solid = polygon border + UI badge
// fill  = semi-transparent polygon interior on the map

export const playerColors = [
  { name: 'tomato',     solid: '#FF4D2E', fill: 'rgba(255,  77,  46, 0.45)' },
  { name: 'mustard',    solid: '#FFB800', fill: 'rgba(255, 184,   0, 0.45)' },
  { name: 'pickle',     solid: '#6BBF3E', fill: 'rgba(107, 191,  62, 0.45)' },
  { name: 'blueberry',  solid: '#4A6FE2', fill: 'rgba( 74, 111, 226, 0.45)' },
  { name: 'grape',      solid: '#9B5DE5', fill: 'rgba(155,  93, 229, 0.45)' },
  { name: 'salmon',     solid: '#FF7F7F', fill: 'rgba(255, 127, 127, 0.45)' },
  { name: 'mint',       solid: '#00C9A7', fill: 'rgba(  0, 201, 167, 0.45)' },
  { name: 'cheddar',    solid: '#FF8C42', fill: 'rgba(255, 140,  66, 0.45)' },
] as const;

export type PlayerColorName = typeof playerColors[number]['name'];

/** Returns the color entry for a given player color name. */
export function getPlayerColor(name: PlayerColorName) {
  return playerColors.find((c) => c.name === name)!;
}

/** Picks a player color by index (wraps around if > 8 players). */
export function getPlayerColorByIndex(index: number) {
  return playerColors[index % playerColors.length];
}
